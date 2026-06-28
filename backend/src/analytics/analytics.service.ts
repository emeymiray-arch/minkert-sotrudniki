import { Injectable } from '@nestjs/common';
import {
  EmployeeStatus,
  OpsTaskStatus,
  OpsTimeBlock,
  Task,
} from '@prisma/client';
import { utcDateToWeekDayDb, WEEK_DAYS_DB } from '../common/constants/days';
import {
  TaskDayValues,
  percentForStatus,
  taskWeekEfficiencyPercent,
  weeklyStreak,
} from '../common/kpi/kpi.util';
import {
  addUtcDays,
  endUtcMonth,
  startUtcMonth,
  startUtcWeekMonday,
} from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';

type TaskWeekRow = Pick<
  Task,
  | 'employeeId'
  | 'taskDate'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun'
>;

export interface SnapshotWeek {
  weekStart: Date;
  weeklyEfficiency: number;
  dailyBreakdown: {
    key: (typeof WEEK_DAYS_DB)[number];
    label: string;
    efficiency: number;
  }[];
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
      const nums = rows.map((r) =>
        percentForStatus((r as never)[col] as number),
      );
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
    const weekEnd = addUtcDays(anchor, 6);
    if (!employeeIds.length) return {};
    const tasks = await this.prisma.task.findMany({
      where: {
        employeeId: { in: employeeIds },
        taskDate: { gte: anchor, lte: weekEnd },
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
        dailyKpiByDay: Object.fromEntries(
          WEEK_DAYS_DB.map((k) => [k, 0]),
        ) as Record<string, number>,
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
    return this.employeeRangeAnalyticsFromRows(
      employeeId,
      rows as TaskWeekRow[],
      from,
      to,
    );
  }

  async batchEmployeeRangeAnalytics(
    employeeIds: string[],
    from: Date,
    to: Date,
  ) {
    const unique = [...new Set(employeeIds.filter(Boolean))];
    if (!unique.length)
      return {} as Record<
        string,
        Awaited<ReturnType<AnalyticsService['employeeRangeAnalytics']>>
      >;

    const rows = await this.prisma.task.findMany({
      where: { employeeId: { in: unique }, taskDate: { gte: from, lte: to } },
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

    const byEmp = new Map<string, TaskWeekRow[]>();
    for (const id of unique) byEmp.set(id, []);
    for (const r of rows as TaskWeekRow[]) {
      byEmp.get(r.employeeId)?.push(r);
    }

    const out: Record<
      string,
      Awaited<ReturnType<AnalyticsService['employeeRangeAnalytics']>>
    > = {};
    for (const [id, empRows] of byEmp) {
      out[id] = this.employeeRangeAnalyticsFromRows(id, empRows, from, to);
    }
    return out;
  }

  private employeeRangeAnalyticsFromRows(
    employeeId: string,
    rows: TaskWeekRow[],
    from: Date,
    to: Date,
  ) {
    void employeeId;
    const byWeek = new Map<number, TaskWeekRow[]>();
    for (const r of rows) {
      const monday = startUtcWeekMonday(r.taskDate).getTime();
      const ls = byWeek.get(monday) ?? [];
      ls.push(r);
      byWeek.set(monday, ls);
    }
    const ascWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
    const series = ascWeeks.map((t) => {
      const snaps = this.buildWeekSnapshot(byWeek.get(t)!);
      return { weekStart: new Date(t), ...snaps };
    });
    const monthStart = startUtcMonth(to);
    const monthEnd = endUtcMonth(to);
    const monthRows = rows.filter(
      (r) => r.taskDate >= monthStart && r.taskDate <= monthEnd,
    );
    const monthlyEfficiency = monthRows.length
      ? this.avg(
          monthRows.map((r) => taskWeekEfficiencyPercent(this.taskVals(r))),
        )
      : 0;

    let growth = 0;
    let decline = 0;
    const lastTwo = series.slice(-2);
    if (lastTwo.length === 2) {
      const diff = lastTwo[1].weeklyEfficiency - lastTwo[0].weeklyEfficiency;
      if (diff >= 0) growth = diff;
      else decline = -diff;
    }

    const weeklyPercentsDescending = [
      ...series.map((w) => w.weeklyEfficiency),
    ].reverse();
    const dailyOverall = WEEK_DAYS_DB.map((col, idx) => {
      const nums = rows.map((r) =>
        percentForStatus((r as never)[col] as number),
      );
      return {
        key: col,
        label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
        efficiency: this.avg(nums),
      };
    });

    return {
      streakWeeks: weeklyStreak(weeklyPercentsDescending, 72),
      series,
      growthPercent: Number(growth.toFixed(2)),
      declinePercent: Number(decline.toFixed(2)),
      monthlyEfficiency: Number(monthlyEfficiency.toFixed(2)),
      periodEfficiency: rows.length
        ? Number(
            this.avg(
              rows.map((r) => taskWeekEfficiencyPercent(this.taskVals(r))),
            ).toFixed(2),
          )
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
    const worst = leaderboard
      .filter((x) => x.weeklyEfficiency > 0)
      .slice(-5)
      .reverse();
    const teamAvgEfficiency = leaderboard.length
      ? this.avg(leaderboard.map((x) => x.weeklyEfficiency))
      : 0;

    const weekEnd = addUtcDays(anchor, 6);
    /* Задачи с низкой готовностью в выбранной неделе */
    const weekTasks = await this.prisma.task.findMany({
      where: {
        employeeId: { in: ids },
        taskDate: { gte: anchor, lte: weekEnd },
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
        weeklyEfficiency: Number(
          taskWeekEfficiencyPercent(this.taskVals(t)).toFixed(2),
        ),
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

  /**
   * KPI управляющего:
   * 1) личные задачи в «Контроле» (доля решенных),
   * 2) KPI команды из чек-листов (0/1/2 → 0%/100%/115%).
   * Периоды считаются автоматически: сегодня, текущая неделя, текущий месяц.
   */
  async managerKpiSummary(asOf = new Date()) {
    const today = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );
    const weekMonday = startUtcWeekMonday(today);
    const weekEnd = addUtcDays(weekMonday, 6);
    const monthStart = startUtcMonth(today);
    const monthEnd = endUtcMonth(today);

    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      select: { id: true },
    });
    const ids = employees.map((e) => e.id);

    const taskSelect = {
      employeeId: true,
      taskDate: true,
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: true,
    } as const;

    const weekTasks = ids.length
      ? await this.prisma.task.findMany({
          where: {
            employeeId: { in: ids },
            taskDate: { gte: weekMonday, lte: weekEnd },
          },
          select: taskSelect,
        })
      : [];

    const todayCol = utcDateToWeekDayDb(today);
    const dailyKpi = weekTasks.length
      ? this.avg(
          weekTasks.map((t) =>
            percentForStatus((t as never)[todayCol] as number),
          ),
        )
      : 0;

    const snapMap = await this.snapshotsForEmployees(ids, weekMonday);
    const weeklyValues = ids.map((id) => snapMap[id]?.weeklyEfficiency ?? 0);
    const weeklyKpi = weeklyValues.length ? this.avg(weeklyValues) : 0;

    const prevMonday = addUtcDays(weekMonday, -7);
    const prevSnap = await this.snapshotsForEmployees(ids, prevMonday);
    const prevWeekly = ids.length
      ? this.avg(ids.map((id) => prevSnap[id]?.weeklyEfficiency ?? 0))
      : 0;
    const weekOverWeekTrend = Number((weeklyKpi - prevWeekly).toFixed(2));

    const monthTasks = ids.length
      ? await this.prisma.task.findMany({
          where: {
            employeeId: { in: ids },
            taskDate: { gte: monthStart, lte: monthEnd },
          },
          select: taskSelect,
        })
      : [];
    const monthlyKpi = monthTasks.length
      ? this.avg(
          monthTasks.map((t) =>
            taskWeekEfficiencyPercent(this.taskVals(t as TaskWeekRow)),
          ),
        )
      : 0;

    const weekdayBreakdown = WEEK_DAYS_DB.map((col, idx) => ({
      key: col,
      label: ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
      efficiency: weekTasks.length
        ? Number(
            this.avg(
              weekTasks.map((t) =>
                percentForStatus((t as never)[col] as number),
              ),
            ).toFixed(2),
          )
        : 0,
    }));

    const weekTasksOps = await this.prisma.opsTask.findMany({
      where: {
        OR: [
          { recurring: true, block: { not: OpsTimeBlock.WEEK } },
          {
            block: OpsTimeBlock.WEEK,
            forDate: { gte: weekMonday, lte: weekEnd },
          },
        ],
      },
      select: { status: true },
    });
    const totalOps = weekTasksOps.length;
    const doneOps = weekTasksOps.filter(
      (t) => t.status === OpsTaskStatus.DONE,
    ).length;
    const managerTasksKpi = totalOps ? (doneOps / totalOps) * 100 : 0;

    return {
      asOf: today.toISOString().slice(0, 10),
      weekAnchor: weekMonday.toISOString().slice(0, 10),
      month: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`,
      activeEmployees: ids.length,
      source: 'manager_tasks_plus_team_checklists' as const,
      managerTasks: {
        label: 'Задачи управляющего',
        solved: doneOps,
        total: totalOps,
        kpi: Number(managerTasksKpi.toFixed(2)),
      },
      teamResults: {
        label: 'Результаты команды',
        kpi: Number(weeklyKpi.toFixed(2)),
      },
      daily: {
        label: 'Сегодня',
        weekday: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'][today.getUTCDay()],
        kpi: Number(dailyKpi.toFixed(2)),
      },
      weekly: {
        label: 'Текущая неделя',
        kpi: Number(weeklyKpi.toFixed(2)),
        weekOverWeekTrend,
      },
      monthly: {
        label: 'Текущий месяц',
        kpi: Number(monthlyKpi.toFixed(2)),
      },
      weekdayBreakdown,
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
        const nums = list.map((r) =>
          percentForStatus((r as never)[col] as number),
        );
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

  readonly weekLabels = WEEK_DAYS_DB.map(
    (_, idx) => ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx],
  );

  overviewTaskShare(employeesCount: number, tasksCompletedRatio: number) {
    /* helper for pie chart */
    const doneApprox = tasksCompletedRatio;
    const openApprox = employeesCount <= 0 ? 0 : Math.max(0, 100 - doneApprox);
    return { doneApprox, openApprox };
  }
}
