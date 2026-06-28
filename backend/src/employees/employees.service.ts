import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { startUtcWeekMonday } from '../common/date/week';
import {
  dailyLogScore,
  weeklyScoresFromDailyLogs,
} from '../common/kpi/daily-log-kpi.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { QueryEmployeesDto } from './dto/query-employees.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpsertDailyLogDto } from './dto/upsert-daily-log.dto';

const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const;

function parseDayParam(raw?: string): Date {
  const iso = raw?.trim() || new Date().toISOString().slice(0, 10);
  return new Date(`${iso}T12:00:00.000Z`);
}

function weekRange(weekMonday: Date) {
  const end = new Date(weekMonday);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: weekMonday, end };
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        name: dto.name.trim(),
        position: dto.position.trim(),
        phone: dto.phone?.trim() ?? '',
        status: dto.status ?? EmployeeStatus.ACTIVE,
      },
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true } },
      },
    });
    if (!e) throw new NotFoundException('Сотрудник не найден');
    return e;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        position: dto.position?.trim(),
        phone: dto.phone?.trim(),
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  async findManyFiltered(q?: QueryEmployeesDto) {
    const where: Prisma.EmployeeWhereInput = {};
    if (q?.q?.trim()) {
      where.name = { contains: q.q.trim(), mode: 'insensitive' };
    }
    if (q?.status) where.status = q.status;

    const orderBy =
      q?.sort === 'nameDesc'
        ? { name: 'desc' as const }
        : q?.sort === 'createdDesc'
          ? { createdAt: 'desc' as const }
          : q?.sort === 'createdAsc'
            ? { createdAt: 'asc' as const }
            : { name: 'asc' as const };

    const list = await this.prisma.employee.findMany({
      where,
      orderBy,
      include: { _count: { select: { tasks: true, dailyLogs: true } } },
    });
    let weekAnchorNormalized: Date | undefined;
    if (q?.weekAnchor) weekAnchorNormalized = startUtcWeekMonday(q.weekAnchor);
    if (!weekAnchorNormalized) return { items: list };

    const { start, end } = weekRange(weekAnchorNormalized);
    const logs = await this.prisma.employeeDailyLog.findMany({
      where: {
        employeeId: { in: list.map((x) => x.id) },
        date: { gte: start, lte: end },
      },
    });
    const logsByEmployee = new Map<string, typeof logs>();
    for (const row of logs) {
      const bucket = logsByEmployee.get(row.employeeId) ?? [];
      bucket.push(row);
      logsByEmployee.set(row.employeeId, bucket);
    }

    const items = list.map((e) => {
      const empLogs = logsByEmployee.get(e.id) ?? [];
      const { daily, weekly } = weeklyScoresFromDailyLogs(
        empLogs,
        weekAnchorNormalized!,
      );
      const weekdayMetrics = DAY_LABELS.map((label, idx) => ({
        label,
        efficiency: daily[idx] ?? 0,
      }));
      return {
        ...e,
        kpiWeekly: weekly,
        kpiWeeklyRounded: Number(weekly.toFixed(1)),
        weekdayMetrics,
      };
    });

    return { items, weekAnchor: weekAnchorNormalized.toISOString() };
  }

  async getDailyBoard(dateRaw?: string, weekAnchorRaw?: string) {
    const date = parseDayParam(dateRaw);
    const weekMonday = startUtcWeekMonday(
      weekAnchorRaw ?? date.toISOString().slice(0, 10),
    );
    const { start, end } = weekRange(weekMonday);

    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
    const logs = await this.prisma.employeeDailyLog.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        date: { gte: start, lte: end },
      },
    });

    const dateIso = date.toISOString().slice(0, 10);
    const items = employees.map((employee) => {
      const empLogs = logs.filter((l) => l.employeeId === employee.id);
      const todayLog =
        empLogs.find((l) => l.date.toISOString().slice(0, 10) === dateIso) ??
        null;
      const { daily, weekly } = weeklyScoresFromDailyLogs(empLogs, weekMonday);
      return {
        employee,
        todayLog,
        todayScore: dailyLogScore(todayLog),
        kpiWeekly: Number(weekly.toFixed(1)),
        weekdayScores: daily.map((efficiency, idx) => ({
          label: DAY_LABELS[idx],
          efficiency,
        })),
      };
    });

    return {
      date: dateIso,
      weekAnchor: weekMonday.toISOString().slice(0, 10),
      items,
    };
  }

  async upsertDailyLog(employeeId: string, dto: UpsertDailyLogDto) {
    await this.findOne(employeeId);
    const date = parseDayParam(dto.date);
    const data = {
      planText: dto.planText?.trim() ?? '',
      reportOnTime: dto.reportOnTime ?? false,
      planDone: dto.planDone ?? false,
      noViolations: dto.noViolations ?? false,
      qualityOk: dto.qualityOk ?? false,
      notes: dto.notes?.trim() ?? '',
    };
    return this.prisma.employeeDailyLog.upsert({
      where: {
        employeeId_date: { employeeId, date },
      },
      create: { employeeId, date, ...data },
      update: data,
    });
  }

  async deleteDailyLog(employeeId: string, dateRaw: string) {
    await this.findOne(employeeId);
    const date = parseDayParam(dateRaw);
    const row = await this.prisma.employeeDailyLog.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (!row) throw new NotFoundException('Отметка за этот день не найдена');
    await this.prisma.employeeDailyLog.delete({ where: { id: row.id } });
    return { ok: true };
  }

  async listDailyLogs(employeeId: string, fromRaw: string, toRaw: string) {
    await this.findOne(employeeId);
    const from = parseDayParam(fromRaw);
    const to = parseDayParam(toRaw);
    const items = await this.prisma.employeeDailyLog.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    });
    return {
      items: items.map((row) => ({
        ...row,
        date: row.date.toISOString().slice(0, 10),
        score: dailyLogScore(row),
      })),
    };
  }

  async bulkPatch(body: {
    patches: Array<{ employeeId: string; data: UpdateEmployeeDto }>;
  }) {
    const ops = await Promise.all(
      body.patches.map((p) => this.update(p.employeeId, p.data)),
    );
    return { updated: ops.length };
  }
}
