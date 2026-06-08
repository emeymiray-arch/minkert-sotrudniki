import { BadRequestException, Injectable } from '@nestjs/common';
import { CrmClientStatus, CrmVisitStatus, UserRole } from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { addUtcDays } from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';

function normalizePhone(raw?: string) {
  return (raw ?? '').replace(/[^\d+]/g, '');
}

function parseDate(raw?: string | null) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new BadRequestException('Ожидается дата в формате YYYY-MM-DD');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseDateTime(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Некорректная дата/время');
  return d;
}

function dateOnlyIso(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function utcToday() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureMasterScope(where: Record<string, unknown>, user?: JwtUserPayload) {
    if (user?.role === UserRole.MANAGER && user.linkedEmployeeId) {
      where.OR = [{ appointments: { some: { masterId: user.linkedEmployeeId } } }, { procedures: { some: { masterId: user.linkedEmployeeId } } }];
    }
  }

  /** Поиск по ФИО: каждое слово должно встречаться в fullName (Иванова Мария → оба фрагмента). */
  private buildNameFilter(query?: string): Record<string, unknown> | undefined {
    const parts = (query ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return undefined;
    if (parts.length === 1) {
      return { fullName: { contains: parts[0], mode: 'insensitive' } };
    }
    return {
      AND: parts.map((part) => ({ fullName: { contains: part, mode: 'insensitive' } })),
    };
  }

  private resolveRecommendedNext(
    recommendedNextAt: Date | null | undefined,
    lastProc?: { procedureDate: Date; intervalDays: number } | null,
  ) {
    if (recommendedNextAt) return recommendedNextAt;
    if (lastProc?.procedureDate && lastProc.intervalDays > 0) {
      return addUtcDays(lastProc.procedureDate, lastProc.intervalDays);
    }
    return null;
  }

  async listClients(q?: string, phone?: string, user?: JwtUserPayload) {
    const where: Record<string, unknown> = {};
    const nameFilter = this.buildNameFilter(q);
    if (nameFilter) Object.assign(where, nameFilter);
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) where.phoneNormalized = { contains: normalizedPhone };
    this.ensureMasterScope(where, user);

    return this.prisma.crmClient.findMany({
      where,
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
        procedures: {
          orderBy: { procedureDate: 'desc' },
          take: 1,
          select: { intervalDays: true, procedureDate: true, service: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async getClient(id: string) {
    const row = await this.prisma.crmClient.findUnique({
      where: { id },
      include: {
        procedures: {
          include: { master: { select: { id: true, name: true } } },
          orderBy: { procedureDate: 'desc' },
        },
        appointments: {
          include: { master: { select: { id: true, name: true } } },
          orderBy: { startsAt: 'desc' },
        },
      },
    });
    if (!row) throw new BadRequestException('Клиент не найден');
    return row;
  }

  async createClient(body: {
    fullName: string;
    phone?: string;
    birthDate?: string;
    note?: string;
  }) {
    const fullName = body.fullName?.trim();
    if (!fullName) throw new BadRequestException('ФИО обязательно');
    const phoneNormalized = normalizePhone(body.phone);
    return this.prisma.crmClient.create({
      data: {
        fullName,
        phone: body.phone?.trim() ?? '',
        phoneNormalized,
        birthDate: parseDate(body.birthDate),
        note: body.note?.trim() ?? '',
      },
    });
  }

  async updateClient(id: string, body: Partial<{ fullName: string; phone: string; birthDate: string | null; note: string; status: CrmClientStatus; warned: boolean }>) {
    return this.prisma.crmClient.update({
      where: { id },
      data: {
        fullName: body.fullName?.trim(),
        phone: body.phone?.trim(),
        phoneNormalized: body.phone !== undefined ? normalizePhone(body.phone) : undefined,
        birthDate: body.birthDate !== undefined ? parseDate(body.birthDate) : undefined,
        note: body.note?.trim(),
        status: body.status,
        warned: body.warned,
      },
    });
  }

  async addProcedure(
    user: JwtUserPayload | undefined,
    clientId: string,
    body: {
      masterId?: string | null;
      procedureDate: string;
      service: string;
      cost: number;
      intervalDays: number;
      masterComment?: string;
      photosBeforeAfter?: unknown;
      nextVisitDate?: string;
      nextVisitComment?: string;
      nextVisitAdvice?: string;
    },
  ) {
    if (user?.role !== UserRole.ADMIN) {
      throw new BadRequestException('Интервал назначает только администратор');
    }
    const procedureDate = parseDate(body.procedureDate);
    if (!procedureDate) throw new BadRequestException('Дата процедуры обязательна');
    const service = body.service?.trim();
    if (!service) throw new BadRequestException('Услуга обязательна');
    const cost = Math.max(0, Math.round(body.cost ?? 0));
    const intervalDays = Math.max(0, Math.round(Number(body.intervalDays)));
    if (!intervalDays) throw new BadRequestException('Интервал обязателен');

    const explicitNext = parseDate(body.nextVisitDate);
    const computedNext = addUtcDays(procedureDate, intervalDays);
    const recommendedNext = explicitNext ?? computedNext;
    const today = utcToday();

    const total = await this.prisma.crmProcedure.count({ where: { clientId } });

    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.crmProcedure.create({
        data: {
          clientId,
          masterId: body.masterId ?? null,
          procedureDate,
          service,
          cost,
          intervalDays,
          sequenceNumber: total + 1,
          masterComment: body.masterComment?.trim() ?? '',
          photosBeforeAfter: body.photosBeforeAfter as object | undefined,
          nextVisitDate: recommendedNext,
          nextVisitComment: body.nextVisitComment?.trim() ?? '',
          nextVisitAdvice: body.nextVisitAdvice?.trim() ?? '',
        },
      });

      await tx.crmClient.update({
        where: { id: clientId },
        data: {
          totalSpent: { increment: cost },
          visitsCount: { increment: 1 },
          lastProcedureAt: procedureDate,
          recommendedNextAt: recommendedNext,
          requiresRepeatContact: recommendedNext <= today,
        },
      });

      return procedure;
    });
  }

  async createAppointment(body: { clientId: string; masterId?: string | null; service: string; startsAt: string; comment?: string }) {
    const startsAt = parseDateTime(body.startsAt);
    const service = body.service?.trim();
    if (!service) throw new BadRequestException('Услуга обязательна');
    return this.prisma.crmAppointment.create({
      data: {
        clientId: body.clientId,
        masterId: body.masterId ?? null,
        service,
        startsAt,
        comment: body.comment?.trim() ?? '',
      },
    });
  }

  async listAppointments(from?: string, to?: string, masterId?: string, user?: JwtUserPayload) {
    const where: Record<string, unknown> = {};
    if (masterId?.trim()) where.masterId = masterId.trim();
    if (user?.role === UserRole.MANAGER && user.linkedEmployeeId) where.masterId = user.linkedEmployeeId;
    const fromDate = from ? parseDateTime(from) : null;
    const toDate = to ? parseDateTime(to) : null;
    if (fromDate || toDate) where.startsAt = { gte: fromDate ?? undefined, lte: toDate ?? undefined };

    return this.prisma.crmAppointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            status: true,
            visitsCount: true,
            lastProcedureAt: true,
            recommendedNextAt: true,
          },
        },
        master: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
    });
  }

  async updateAppointmentStatus(id: string, visitStatus: CrmVisitStatus) {
    const appt = await this.prisma.crmAppointment.update({
      where: { id },
      data: { visitStatus },
    });

    let status: CrmClientStatus | undefined;
    if (visitStatus === CrmVisitStatus.ARRIVED) status = CrmClientStatus.BLUE;
    if (visitStatus === CrmVisitStatus.NO_SHOW) status = CrmClientStatus.BLACK;
    if (visitStatus === CrmVisitStatus.SCHEDULED) status = CrmClientStatus.GREEN;
    if (status) {
      await this.prisma.crmClient.update({ where: { id: appt.clientId }, data: { status } });
    }
    return appt;
  }

  async dueForRepeat(q?: string, user?: JwtUserPayload) {
    const rows = await this.listIntervals(q, user);
    return rows.filter((r) => r.urgency === 'overdue' || r.urgency === 'due_soon');
  }

  async listIntervals(q?: string, user?: JwtUserPayload) {
    const where: Record<string, unknown> = {
      procedures: { some: {} },
    };
    const nameFilter = this.buildNameFilter(q);
    if (nameFilter) Object.assign(where, nameFilter);
    this.ensureMasterScope(where, user);

    const today = utcToday();
    const clients = await this.prisma.crmClient.findMany({
      where,
      include: {
        procedures: {
          orderBy: { procedureDate: 'desc' },
          take: 1,
          select: { intervalDays: true, procedureDate: true, service: true },
        },
      },
      orderBy: { recommendedNextAt: 'asc' },
      take: 300,
    });

    return clients
      .map((c) => {
        const lastProc = c.procedures[0] ?? null;
        const nextAt = this.resolveRecommendedNext(c.recommendedNextAt, lastProc);
        const daysUntilNext = nextAt ? daysBetween(today, nextAt) : null;
        let urgency: 'overdue' | 'due_soon' | 'ok' | 'unknown' = 'unknown';
        if (daysUntilNext !== null) {
          if (daysUntilNext < 0) urgency = 'overdue';
          else if (daysUntilNext <= 7) urgency = 'due_soon';
          else urgency = 'ok';
        }
        return {
          id: c.id,
          fullName: c.fullName,
          phone: c.phone,
          status: c.status,
          warned: c.warned,
          lastProcedureAt: dateOnlyIso(c.lastProcedureAt),
          recommendedNextAt: dateOnlyIso(nextAt),
          intervalDays: lastProc?.intervalDays ?? null,
          lastService: lastProc?.service ?? null,
          daysUntilNext,
          urgency,
          requiresRepeatContact: c.requiresRepeatContact,
        };
      })
      .sort((a, b) => {
        const da = a.daysUntilNext ?? 9999;
        const db = b.daysUntilNext ?? 9999;
        return da - db;
      });
  }

  async lostClients(days = 90) {
    const edge = new Date();
    edge.setUTCDate(edge.getUTCDate() - Math.max(1, Math.round(days)));
    return this.prisma.crmClient.findMany({
      where: {
        OR: [
          { lastProcedureAt: { lte: edge } },
          { lastProcedureAt: null },
        ],
        appointments: { none: { startsAt: { gte: new Date() } } },
      },
      orderBy: { lastProcedureAt: 'asc' },
      take: 300,
    });
  }

  async analytics() {
    const now = new Date();
    const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startWeek = new Date(startDay);
    startWeek.setUTCDate(startWeek.getUTCDate() - ((startWeek.getUTCDay() + 6) % 7));
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const [
      clientsTotal,
      newClients,
      appointmentsTotal,
      arrived,
      canceled,
      noShows,
      dayRevenue,
      weekRevenue,
      monthRevenue,
      yearRevenue,
    ] = await Promise.all([
      this.prisma.crmClient.count(),
      this.prisma.crmClient.count({ where: { createdAt: { gte: startMonth } } }),
      this.prisma.crmAppointment.count(),
      this.prisma.crmAppointment.count({ where: { visitStatus: CrmVisitStatus.ARRIVED } }),
      this.prisma.crmAppointment.count({ where: { visitStatus: CrmVisitStatus.CANCELED } }),
      this.prisma.crmAppointment.count({ where: { visitStatus: CrmVisitStatus.NO_SHOW } }),
      this.prisma.crmProcedure.aggregate({ _sum: { cost: true }, where: { procedureDate: { gte: startDay } } }),
      this.prisma.crmProcedure.aggregate({ _sum: { cost: true }, where: { procedureDate: { gte: startWeek } } }),
      this.prisma.crmProcedure.aggregate({ _sum: { cost: true }, where: { procedureDate: { gte: startMonth } } }),
      this.prisma.crmProcedure.aggregate({ _sum: { cost: true }, where: { procedureDate: { gte: startYear } } }),
    ]);

    const perMaster = await this.prisma.crmProcedure.groupBy({
      by: ['masterId'],
      _sum: { cost: true },
      _count: { _all: true },
      where: { masterId: { not: null } },
    });

    const masterIds = perMaster.map((p) => p.masterId!).filter(Boolean);
    const masters = masterIds.length ?
      await this.prisma.employee.findMany({ where: { id: { in: masterIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(masters.map((m) => [m.id, m.name]));

    return {
      clientsTotal,
      newClients,
      appointmentsTotal,
      arrived,
      canceled,
      noShows,
      revenue: {
        day: dayRevenue._sum.cost ?? 0,
        week: weekRevenue._sum.cost ?? 0,
        month: monthRevenue._sum.cost ?? 0,
        year: yearRevenue._sum.cost ?? 0,
      },
      byMasters: perMaster.map((m) => ({
        masterId: m.masterId,
        masterName: nameMap.get(m.masterId ?? '') ?? '—',
        procedures: m._count._all,
        revenue: m._sum.cost ?? 0,
      })),
    };
  }
}
