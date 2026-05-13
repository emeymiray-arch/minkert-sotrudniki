import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { WEEK_DAYS_DB } from '../common/constants/days';
import { startUtcWeekMonday } from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { QueryEmployeesDto } from './dto/query-employees.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        name: dto.name.trim(),
        position: dto.position.trim(),
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
      include: { _count: { select: { tasks: true } } },
    });
    let weekAnchorNormalized: Date | undefined;
    if (q?.weekAnchor) weekAnchorNormalized = startUtcWeekMonday(q.weekAnchor);
    if (!weekAnchorNormalized) return { items: list };

    const snap = await this.analytics.snapshotsForEmployees(
      list.map((x) => x.id),
      weekAnchorNormalized,
    );

    const items = list.map((e) => {
      const kpis = snap[e.id];
      const dailyPairs = kpis?.dailyKpiByDay ?? {};
      const weekdayMetrics = WEEK_DAYS_DB.map((key, idx) => {
        const label = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][idx];
        const v = dailyPairs[key];
        return { label, efficiency: typeof v === 'number' ? v : 0 };
      });
      return {
        ...e,
        kpiWeekly: kpis?.weeklyEfficiency ?? 0,
        kpiWeeklyRounded: Number((kpis?.weeklyEfficiency ?? 0).toFixed(2)),
        weekdayMetrics,
      };
    });

    return { items, weekAnchor: weekAnchorNormalized.toISOString() };
  }

  async bulkPatch(body: {
    patches: Array<{ employeeId: string; data: UpdateEmployeeDto }>;
  }) {
    const ops = [];
    for (const p of body.patches) {
      ops.push(await this.update(p.employeeId, p.data));
    }
    return { updated: ops.length };
  }
}
