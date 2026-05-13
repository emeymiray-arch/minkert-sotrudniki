import { Injectable } from '@nestjs/common';
import { EmployeeStatus, Task } from '@prisma/client';
import { WEEK_DAYS_DB } from '../common/constants/days';
import {
  TaskDayValues,
  percentForStatus,
  taskWeekEfficiencyPercent,
  weeklyStreak,
} from '../common/kpi/kpi.util';
import { addUtcDays, endUtcMonth, startUtcMonth, startUtcWeekMonday } from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';

type TaskWeekRow = Pick<
  Task,
  'employeeId' | 'taskDate' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
>;

export interface SnapshotWeek {
  weekStart: Date;
  weeklyEfficiency: number;
  dailyBreakdown: { key: typeof WEEK_DAYS_DB[number]; label: string; efficiency: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private taskVals(t: TaskWeekRow): TaskDayValues {
    return {
      mon: t.mon,
      tue: t.tue,
      wed: t.wed,
      thu: t.thu,
      fri: t.fri,
      sat: t.sat,
      sun: t.sun,
    };
  }

  private avg(nums: number[]): number {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  buildWeekSnapshot(rows: TaskWeekRow[]): Omit<SnapshotWeek, 'weekStart'> {
    if (!rows.length) {
      return {
        weeklyEfficiency: 0,
        dailyBreakdown: WEEK_DAYS_DB.map((k, idx) => ({
          key: k,
          label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
          efficiency: 0,
        })),
      };
    }
    const weekly = rows.map((r) => taskWeekEfficiencyPercent(this.taskVals(r)));
    const dailyBreakdown = WEEK_DAYS_DB.map((col, idx) => {
      const nums = rows.map((r) => percentForStatus((r as never)[col] as number));
      return {
        key: col,
        label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
        efficiency: this.avg(nums),
      };
    });
    return {
      weeklyEfficiency: this.avg(weekly),
      dailyBreakdown,
    };
  }

  async snapshotsForEmployees(employeeIds: string[], weekStart: Date) {
    const anchor = startUtcWeekMonday(weekStart);
    if (!employeeIds.length) return {};
    const tasks = await this.prisma.task.findMany({
      where: {
        employeeId: { in: employeeIds },
        taskDate: anchor,
      },
      select: {
        employeeId: true,
        taskDate: true,
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: true,
      },
    });
    const map: Record<
      string,
      { weeklyEfficiency: number; dailyKpiByDay: Record<string, number> }
    > = {};
    for (const id of employeeIds) {
      map[id] = {
        weeklyEfficiency: 0,
        dailyKpiByDay: Object.fromEntries(WEEK_DAYS_DB.map((k) => [k, 0])) as Record<string, number>,
      };
    }
    const byEmp = new Map<string, TaskWeekRow[]>();
    for (const t of tasks) {
      const list = byEmp.get(t.employeeId) ?? [];
      list.push(t as TaskWeekRow);
      byEmp.set(t.employeeId, list);
    }
    for (const [id, list] of byEmp) {
      const snap = this.buildWeekSnapshot(list);
      map[id] = {
        weeklyEfficiency: snap.weeklyEfficiency,
        dailyKpiByDay: Object.fromEntries(
          snap.dailyBreakdown.map((d) => [d.key, d.efficiency]),
        ),
      };
    }
    return map;
  }

  async employeeRangeAnalytics(employeeId: string, from: Date, to: Date) {
    const rows = await this.prisma.task.findMany({
      where: {
        employeeId,
        taskDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { taskDate: 'asc' },
      select: {
        taskDate: true,
        employeeId: true,
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: true,
      },
    });
    const byWeek = new Map<number, TaskWeekRow[]>();
    for (const r of rows as TaskWeekRow[]) {
      const monday = startUtcWeekMonday(r.taskDate).getTime();
      const ls = byWeek.get(monday) ?? [];
      ls.push(r as TaskWeekRow);
      byWeek.set(monday, ls);
    }
    const ascWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
    const series = ascWeeks.map((t) => {
      const snaps = this.buildWeekSnapshot(byWeek.get(t)!);
      return { weekStart: new Date(t), ...snaps };
    });
    const monthStart = startUtcMonth(to);
    const monthEnd = endUtcMonth(to);
    const monthRows = rows.filter((r) => r.taskDate >= monthStart && r.taskDate <= monthEnd);
    const monthlyEfficiency = monthRows.length
      ? this.avg(monthRows.map((r) => taskWeekEfficiencyPercent(this.taskVals(r as TaskWeekRow))))
      : 0;

    let growth = 0;
    let decline = 0;
    const lastTwo = series.slice(-2);
    if (lastTwo.length === 2) {
      const diff = lastTwo[1].weeklyEfficiency - lastTwo[0].weeklyEfficiency;
      if (diff >= 0) growth = diff;
      else decline = -diff;
    }

    const weeklyPercentsDescending = [...series.map((w) => w.weeklyEfficiency)].reverse();

    const dailyOverall = WEEK_DAYS_DB.map((col, idx) => {
      const nums = rows.map((r) => percentForStatus((r as never)[col] as number));
      return { key: col, label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx], efficiency: this.avg(nums) };
    });

    return {
      streakWeeks: weeklyStreak(weeklyPercentsDescending, 72),
      series,
      growthPercent: Number(growth.toFixed(2)),
      declinePercent: Number(decline.toFixed(2)),
      monthlyEfficiency: Number(monthlyEfficiency.toFixed(2)),
      periodEfficiency:
        rows.length ?
          Number(this.avg(rows.map((r) => taskWeekEfficiencyPercent(this.taskVals(r as TaskWeekRow)))).toFixed(2))
        : 0,
      dailyHeatByWeekday: dailyOverall,
    };
  }

  async teamDashboard(weekStart: Date) {
    const anchor = startUtcWeekMonday(weekStart);
    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
    const ids = employees.map((e) => e.id);
    const snapMap = await this.snapshotsForEmployees(ids, anchor);
    const leaderboard = [...ids]
      .map((id) => ({
        employeeId: id,
        weeklyEfficiency: snapMap[id]?.weeklyEfficiency ?? 0,
      }))
      .sort((a, b) => b.weeklyEfficiency - a.weeklyEfficiency);
    const best = leaderboard.slice(0, 5);
    const worst = leaderboard.filter((x) => x.weeklyEfficiency > 0).slice(-5).reverse();
    const teamAvgEfficiency = leaderboard.length ? this.avg(leaderboard.map((x) => x.weeklyEfficiency)) : 0;

    /* Задачи с низкой готовностью в выбранной неделе */
    const weekTasks = await this.prisma.task.findMany({
      where: {
        employeeId: { in: ids },
        taskDate: anchor,
      },
      include: {
        employee: true,
      },
    });
    const lowTasks = weekTasks
      .map((t) => ({
        id: t.id,
        employeeName: t.employee.name,
        title: t.title,
        weeklyEfficiency: Number(taskWeekEfficiencyPercent(this.taskVals(t)).toFixed(2)),
      }))
      .sort((a, b) => a.weeklyEfficiency - b.weeklyEfficiency)
      .slice(0, 12);

    const prevMonday = addUtcDays(anchor, -7);
    const prevSnap = await this.snapshotsForEmployees(ids, prevMonday);
    const prevAvg = leaderboard.length
      ? this.avg(ids.map((id) => prevSnap[id]?.weeklyEfficiency ?? 0))
      : 0;
    const trendDelta = Number((teamAvgEfficiency - prevAvg).toFixed(2));

    return {
      anchor,
      teamAvgEfficiency: Number(teamAvgEfficiency.toFixed(2)),
      weekOverWeekTrend: trendDelta,
      best,
      atRiskEmployees: worst,
      lowPerformingTasks: lowTasks,
    };
  }

  async heatmap(from: Date, to: Date) {
    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    const tasks = await this.prisma.task.findMany({
      where: {
        taskDate: {
          gte: from,
          lte: to,
        },
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: {
        employeeId: true,
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: true,
      },
    });
    const byEmp = new Map<string, typeof tasks>();
    for (const e of employees) byEmp.set(e.id, []);
    for (const t of tasks) {
      const ls = byEmp.get(t.employeeId) ?? [];
      ls.push(t);
      byEmp.set(t.employeeId, ls);
    }
    return employees.map((e) => {
      const list = byEmp.get(e.id) ?? [];
      const cells = WEEK_DAYS_DB.map((col, idx) => {
        const nums = list.map((r) => percentForStatus((r as never)[col] as number));
        return {
          key: col,
          label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
          value: this.avg(nums),
        };
      });
      return { employeeId: e.id, name: e.name, cells };
    });
  }

  monthlyOverview(monthDate: Date) {
    const from = startUtcMonth(monthDate);
    const to = endUtcMonth(monthDate);
    return { from, to };
  }

  weeklyOverview(date: Date) {
    const from = startUtcWeekMonday(date);
    const to = addUtcDays(from, 7);
    return { from, to };
  }

  readonly weekLabels = WEEK_DAYS_DB.map((_, idx) =>
    ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
  );

  overviewTaskShare(employeesCount: number, tasksCompletedRatio: number) {
    /* helper for pie chart */
    const doneApprox = tasksCompletedRatio;
    const openApprox = employeesCount <= 0 ? 0 : Math.max(0, 100 - doneApprox);
    return { doneApprox, openApprox };
  }
}
