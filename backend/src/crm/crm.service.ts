import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmClientStatus, CrmVisitStatus, UserRole } from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { addUtcDays } from '../common/date/week';
import { NotificationsService } from '../notifications/notifications.service';
import { OperationsFinanceService } from '../operations/operations-finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { calcProcedurePricing } from './crm-pricing.util';
import {
  normalizeCrmConfig,
  type CrmSalon,
  type CrmWorkspaceConfig,
} from './crm-config.util';
import {
  appointmentEndsAt,
  appointmentsOverlap,
  formatTimeRange,
  normalizeDurationMinutes,
  parseScheduleDate,
  SCHEDULE_DAY_END_HOUR,
  SCHEDULE_DAY_START_HOUR,
} from './crm-schedule.util';
import {
  computeIntervalCompliance,
  minIntervalDaysForSequence,
} from './crm-interval.util';

const BLOCKING_VISIT_STATUSES: CrmVisitStatus[] = [
  CrmVisitStatus.SCHEDULED,
  CrmVisitStatus.ARRIVED,
];

/** Показываем в расписании мастеров (включая отмены — окно снова свободно). */
const SCHEDULE_DISPLAY_STATUSES: CrmVisitStatus[] = [
  ...BLOCKING_VISIT_STATUSES,
  CrmVisitStatus.CANCELED,
];

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly finance: OperationsFinanceService,
  ) {}

  private async loadCrmConfig(): Promise<CrmWorkspaceConfig> {
    const row = await this.prisma.opsSettings.findUnique({ where: { id: 'default' } });
    return normalizeCrmConfig({
      salons: row?.crmSalons,
      masterEmployeeIds: row?.crmMasterIds,
    });
  }

  async getWorkspaceConfig() {
    const config = await this.loadCrmConfig();
    const masters = await this.listMasters(false);
    return { salons: config.salons, masters };
  }

  async updateWorkspaceConfig(body: { salons?: CrmSalon[] }) {
    const current = await this.loadCrmConfig();
    const salons = body.salons ?? current.salons;
    await this.prisma.opsSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', crmSalons: salons },
      update: { crmSalons: salons },
    });
    return this.getWorkspaceConfig();
  }

  async listMasters(includeInactive = true) {
    return this.prisma.crmMaster.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        specialty: true,
        salonId: true,
        active: true,
        sortOrder: true,
      },
    });
  }

  async createMaster(body: { name: string; phone?: string; specialty?: string; salonId?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Имя мастера обязательно');
    const count = await this.prisma.crmMaster.count();
    return this.prisma.crmMaster.create({
      data: {
        name,
        phone: body.phone?.trim() ?? '',
        specialty: body.specialty?.trim() ?? '',
        salonId: body.salonId?.trim() ?? '',
        sortOrder: count,
      },
    });
  }

  async updateMaster(
    id: string,
    body: Partial<{ name: string; phone: string; specialty: string; salonId: string; active: boolean; sortOrder: number }>,
  ) {
    await this.prisma.crmMaster.findUniqueOrThrow({ where: { id } });
    return this.prisma.crmMaster.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        phone: body.phone?.trim(),
        specialty: body.specialty?.trim(),
        salonId: body.salonId?.trim(),
        active: body.active,
        sortOrder: body.sortOrder,
      },
    });
  }

  async deleteMaster(id: string) {
    await this.prisma.crmMaster.update({ where: { id }, data: { active: false } });
    return { ok: true };
  }

  async resolveMasters() {
    return this.listMasters(false);
  }

  private masterIdForUser(user?: JwtUserPayload) {
    if (!user || user.role !== UserRole.MASTER) return null;
    return user.linkedCrmMasterId ?? user.linkedEmployeeId ?? null;
  }

  async getSchedule(dateRaw: string, salonId?: string) {
    let day: Date;
    try {
      day = parseScheduleDate(dateRaw);
    } catch {
      throw new BadRequestException('Дата: YYYY-MM-DD');
    }
    const dayFinish = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1));
    const masters = await this.listMasters(false);
    const filteredMasters =
      salonId?.trim() ? masters.filter((m) => !m.salonId || m.salonId === salonId.trim()) : masters;

    const appointments = await this.prisma.crmAppointment.findMany({
      where: {
        startsAt: { gte: day, lt: dayFinish },
        visitStatus: { in: SCHEDULE_DISPLAY_STATUSES },
        ...(salonId?.trim() ? { salonId: salonId.trim() } : {}),
      },
      include: {
        client: { select: { id: true, fullName: true, phone: true, status: true, visitsCount: true } },
        master: { select: { id: true, name: true, specialty: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const mapRow = (a: (typeof appointments)[number]) => {
      const dur = normalizeDurationMinutes(a.durationMinutes);
      const end = appointmentEndsAt(a.startsAt, dur);
      return {
        id: a.id,
        clientId: a.client.id,
        masterId: a.masterId,
        masterName: a.master?.name ?? '—',
        startsAt: a.startsAt.toISOString(),
        endsAt: end.toISOString(),
        durationMinutes: dur,
        timeLabel: formatTimeRange(a.startsAt, end),
        service: a.service,
        clientName: a.client.fullName,
        clientPhone: a.client.phone,
        clientStatus: a.client.status,
        visitStatus: a.visitStatus,
        canceled: a.visitStatus === CrmVisitStatus.CANCELED,
      };
    };

    const board = filteredMasters.map((master) => ({
      ...master,
      items: appointments.filter((a) => a.masterId === master.id).map(mapRow),
    }));

    return {
      date: dateOnlyIso(day),
      dayStart: `${String(SCHEDULE_DAY_START_HOUR).padStart(2, '0')}:00`,
      dayEnd: `${String(SCHEDULE_DAY_END_HOUR).padStart(2, '0')}:00`,
      masters: board,
      appointments: appointments.map(mapRow),
    };
  }

  private salonMeta(config: CrmWorkspaceConfig, salonId: string) {
    const salon = config.salons.find((s) => s.id === salonId);
    return salon ?? { id: salonId, name: '—', address: '' };
  }

  private async assertMasterSlotFree(
    masterId: string,
    startsAt: Date,
    durationMinutes: number,
    excludeId?: string,
  ) {
    const dur = normalizeDurationMinutes(durationMinutes);
    const dayStart = new Date(startsAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const existing = await this.prisma.crmAppointment.findMany({
      where: {
        masterId,
        visitStatus: { in: BLOCKING_VISIT_STATUSES },
        startsAt: { gte: dayStart, lt: dayEnd },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      include: { client: { select: { fullName: true } } },
    });
    const conflict = existing.find((a) =>
      appointmentsOverlap(startsAt, dur, a.startsAt, normalizeDurationMinutes(a.durationMinutes)),
    );
    if (conflict) {
      throw new BadRequestException(
        `Мастер уже занят в это время (клиент: ${conflict.client.fullName}). Выберите другое время.`,
      );
    }
  }

  async checkMasterSlot(masterId: string, startsAt: string, durationMinutes?: number) {
    const at = parseDateTime(startsAt);
    const dur = normalizeDurationMinutes(durationMinutes);
    const dayStart = new Date(at);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const existing = await this.prisma.crmAppointment.findMany({
      where: {
        masterId,
        visitStatus: { in: BLOCKING_VISIT_STATUSES },
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      include: { client: { select: { fullName: true } } },
    });
    const conflict = existing.find((a) =>
      appointmentsOverlap(at, dur, a.startsAt, normalizeDurationMinutes(a.durationMinutes)),
    );
    return {
      available: !conflict,
      conflictClient: conflict?.client.fullName ?? null,
    };
  }

  private ensureMasterScope(where: Record<string, unknown>, user?: JwtUserPayload) {
    const masterId = this.masterIdForUser(user);
    if (masterId) {
      where.OR = [
        { appointments: { some: { masterId } } },
        { procedures: { some: { masterId } } },
      ];
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

  private enrichClientRow(
    c: {
      id: string;
      fullName: string;
      phone: string;
      phoneNormalized: string;
      note: string;
      status: CrmClientStatus;
      warned: boolean;
      totalSpent: number;
      visitsCount: number;
      lastProcedureAt: Date | null;
      recommendedNextAt: Date | null;
      procedures?: Array<{ intervalDays: number; procedureDate: Date; service: string; sequenceNumber?: number }>;
      appointments?: unknown[];
    },
    loyaltyStamps?: number,
  ) {
    const compliance = computeIntervalCompliance(c.visitsCount, c.lastProcedureAt);
    const lastProc = c.procedures?.[0];
    return {
      ...c,
      lastProcedureAt: dateOnlyIso(c.lastProcedureAt),
      recommendedNextAt: dateOnlyIso(c.recommendedNextAt),
      loyaltyStamps: loyaltyStamps ?? null,
      interval: compliance,
      lastProcedure: lastProc ?
        {
          service: lastProc.service,
          intervalDays: lastProc.intervalDays,
          procedureDate: dateOnlyIso(lastProc.procedureDate),
          sequenceNumber: lastProc.sequenceNumber,
        }
      : null,
    };
  }

  private async loyaltyStampCount(phoneNormalized: string) {
    if (!phoneNormalized) return null;
    const row = await this.prisma.loyaltyClient.findFirst({
      where: { phoneNormalized },
      select: { _count: { select: { stamps: true } } },
    });
    return row ? row._count.stamps : null;
  }

  private async batchLoyaltyStamps(phones: string[]) {
    const unique = [...new Set(phones.filter(Boolean))];
    const map = new Map<string, number>();
    if (!unique.length) return map;
    const rows = await this.prisma.loyaltyClient.findMany({
      where: { phoneNormalized: { in: unique } },
      select: { phoneNormalized: true, _count: { select: { stamps: true } } },
    });
    for (const row of rows) map.set(row.phoneNormalized, row._count.stamps);
    return map;
  }

  /** Первая процедура → карточка в программе лояльности (если есть телефон). */
  private async ensureLoyaltyForFirstVisit(client: {
    fullName: string;
    phone: string;
    phoneNormalized: string;
    visitsCount: number;
  }) {
    if (client.visitsCount > 0) return null;
    const digits = client.phoneNormalized.replace(/\D/g, '');
    if (digits.length < 10) return null;

    const existing = await this.prisma.loyaltyClient.findFirst({
      where: { phoneNormalized: client.phoneNormalized },
    });
    if (existing) return existing;

    return this.prisma.loyaltyClient.create({
      data: {
        name: client.fullName,
        phone: client.phone,
        phoneNormalized: client.phoneNormalized,
      },
    });
  }

  async deleteClient(id: string) {
    const row = await this.prisma.crmClient.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Клиент не найден');
    await this.prisma.crmClient.delete({ where: { id } });
    return { ok: true, id };
  }

  async clientIntervalStatus(clientId: string, plannedAt?: string) {
    const client = await this.prisma.crmClient.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const ref = plannedAt ? parseDateTime(plannedAt) : utcToday();
    return computeIntervalCompliance(client.visitsCount, client.lastProcedureAt, ref);
  }

  async listClients(q?: string, phone?: string, user?: JwtUserPayload) {
    const where: Record<string, unknown> = {};
    const nameFilter = this.buildNameFilter(q);
    if (nameFilter) Object.assign(where, nameFilter);
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) where.phoneNormalized = { contains: normalizedPhone };
    this.ensureMasterScope(where, user);

    const rows = await this.prisma.crmClient.findMany({
      where,
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
        procedures: {
          orderBy: { procedureDate: 'desc' },
          take: 1,
          select: { intervalDays: true, procedureDate: true, service: true, sequenceNumber: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const stampMap = await this.batchLoyaltyStamps(rows.map((c) => c.phoneNormalized));
    return rows.map((c) => this.enrichClientRow(c, stampMap.get(c.phoneNormalized)));
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
    const stamps = await this.loyaltyStampCount(row.phoneNormalized);
    return {
      ...this.enrichClientRow(
        {
          ...row,
          procedures: row.procedures.map((p) => ({
            intervalDays: p.intervalDays,
            procedureDate: p.procedureDate,
            service: p.service,
            sequenceNumber: p.sequenceNumber,
          })),
        },
        stamps ?? undefined,
      ),
      procedures: row.procedures.map((p) => ({
        ...p,
        procedureDate: dateOnlyIso(p.procedureDate),
        nextVisitDate: dateOnlyIso(p.nextVisitDate),
      })),
      appointments: row.appointments.map((a) => ({
        ...a,
        startsAt: a.startsAt.toISOString(),
      })),
    };
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

  async updateClient(
    id: string,
    body: Partial<{
      fullName: string;
      phone: string;
      birthDate: string | null;
      note: string;
      status: CrmClientStatus;
      warned: boolean;
      discountPercent: number;
    }>,
  ) {
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
        discountPercent:
          body.discountPercent !== undefined ?
            Math.min(100, Math.max(0, Math.round(body.discountPercent)))
          : undefined,
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
      basePrice?: number;
      discountPercent?: number;
      extraService?: string;
      extraCost?: number;
      intervalDays: number;
      masterComment?: string;
      photosBeforeAfter?: unknown;
      nextVisitDate?: string;
      nextVisitComment?: string;
      nextVisitAdvice?: string;
    },
  ) {
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.MANAGER) {
      throw new BadRequestException('Недостаточно прав');
    }
    const procedureDate = parseDate(body.procedureDate);
    if (!procedureDate) throw new BadRequestException('Дата процедуры обязательна');
    const service = body.service?.trim();
    if (!service) throw new BadRequestException('Услуга обязательна');
    const intervalDays = Math.max(0, Math.round(Number(body.intervalDays)));

    const clientRow = await this.prisma.crmClient.findUnique({ where: { id: clientId } });
    if (!clientRow) throw new NotFoundException('Клиент не найден');

    const basePrice = Math.max(0, Math.round(body.basePrice ?? body.cost ?? 0));
    const discountPercent =
      body.discountPercent !== undefined ?
        Math.min(100, Math.max(0, Math.round(body.discountPercent)))
      : clientRow.discountPercent;
    const extraCost = Math.max(0, Math.round(body.extraCost ?? 0));
    const pricing = calcProcedurePricing(basePrice, discountPercent, extraCost);
    const cost = pricing.cost;
    if (!intervalDays) throw new BadRequestException('Интервал обязателен');

    const total = await this.prisma.crmProcedure.count({ where: { clientId } });
    const nextSeq = total + 1;
    const minInterval = minIntervalDaysForSequence(nextSeq);
    if (intervalDays < minInterval) {
      throw new BadRequestException(
        `Для процедуры №${nextSeq} минимальный интервал — ${minInterval} дн. (указано ${intervalDays}).`,
      );
    }

    const explicitNext = parseDate(body.nextVisitDate);
    const computedNext = addUtcDays(procedureDate, intervalDays);
    const recommendedNext = explicitNext ?? computedNext;
    const today = utcToday();

    const procedure = await this.prisma.$transaction(async (tx) => {
      const row = await tx.crmProcedure.create({
        data: {
          clientId,
          masterId: body.masterId ?? null,
          procedureDate,
          service,
          cost,
          basePrice: pricing.basePrice,
          discountPercent: pricing.discountPercent,
          discountAmount: pricing.discountAmount,
          extraService: body.extraService?.trim() ?? '',
          extraCost: pricing.extraCost,
          finalPrice: pricing.finalPrice,
          masterSalary: pricing.masterSalary,
          intervalDays,
          sequenceNumber: nextSeq,
          masterComment: body.masterComment?.trim() ?? '',
          photosBeforeAfter: body.photosBeforeAfter as object | undefined,
          nextVisitDate: recommendedNext,
          nextVisitComment: body.nextVisitComment?.trim() ?? '',
          nextVisitAdvice: body.nextVisitAdvice?.trim() ?? '',
        },
      });

      const client = await tx.crmClient.update({
        where: { id: clientId },
        data: {
          totalSpent: { increment: pricing.finalPrice },
          visitsCount: { increment: 1 },
          lastProcedureAt: procedureDate,
          recommendedNextAt: recommendedNext,
          requiresRepeatContact: recommendedNext <= today,
        },
      });

      if (nextSeq === 1) {
        await this.ensureLoyaltyForFirstVisit(client);
      }

      return row;
    });

    await this.finance.syncFromProcedures(dateOnlyIso(procedureDate) ?? undefined);
    return procedure;
  }

  async createAppointment(body: {
    clientId?: string;
    newClient?: { fullName: string; phone?: string };
    masterId?: string | null;
    salonId?: string;
    service: string;
    startsAt: string;
    durationMinutes?: number;
    sequenceNumber?: number;
    comment?: string;
    forceInterval?: boolean;
  }) {
    const startsAt = parseDateTime(body.startsAt);
    const durationMinutes = normalizeDurationMinutes(body.durationMinutes);
    const service = body.service?.trim();
    if (!service) throw new BadRequestException('Услуга обязательна');

    const masterId = body.masterId?.trim();
    if (!masterId) throw new BadRequestException('Выберите мастера');

    const config = await this.loadCrmConfig();
    const master = await this.prisma.crmMaster.findFirst({ where: { id: masterId, active: true } });
    if (!master) {
      throw new BadRequestException('Выбранный мастер не найден');
    }

    const salonId = body.salonId?.trim() || config.salons[0]?.id || '';
    if (!config.salons.some((s) => s.id === salonId)) {
      throw new BadRequestException('Выберите салон');
    }

    await this.assertMasterSlotFree(masterId, startsAt, durationMinutes);

    let clientId = body.clientId?.trim();
    let client =
      clientId ?
        await this.prisma.crmClient.findUnique({ where: { id: clientId } })
      : null;

    if (!client && body.newClient?.fullName?.trim()) {
      const created = await this.createClient({
        fullName: body.newClient.fullName,
        phone: body.newClient.phone,
      });
      client = created;
      clientId = created.id;
    }

    if (!client || !clientId) {
      throw new BadRequestException('Укажите клиента или создайте нового (ФИО)');
    }

    const sequenceNumber = Math.max(1, Math.round(Number(body.sequenceNumber ?? client.visitsCount + 1)));

    const compliance = computeIntervalCompliance(client.visitsCount, client.lastProcedureAt, startsAt);
    if (!compliance.intervalOk && !body.forceInterval) {
      throw new BadRequestException(compliance.message);
    }

    const salon = this.salonMeta(config, salonId);
    const appointment = await this.prisma.crmAppointment.create({
      data: {
        clientId,
        masterId,
        salonId,
        service,
        sequenceNumber,
        startsAt,
        durationMinutes,
        comment: body.comment?.trim() ?? '',
      },
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
    });

    let loyaltyCreated = false;
    if (sequenceNumber === 1 && client.visitsCount === 0) {
      const loyalty = await this.ensureLoyaltyForFirstVisit(client);
      loyaltyCreated = Boolean(loyalty);
    }

    await this.prisma.crmClient.update({
      where: { id: clientId },
      data: { status: CrmClientStatus.GREEN },
    });

    await this.notifications.appointmentCreated({
      clientName: client.fullName,
      masterName: appointment.master?.name,
      startsAt: appointment.startsAt.toISOString(),
      service: appointment.service,
      masterId: appointment.masterId,
    });

    return {
      appointment: {
        ...appointment,
        salonName: salon.name,
        salonAddress: salon.address,
      },
      intervalWarning: compliance.intervalOk ? null : compliance.message,
      loyaltyCreated,
    };
  }

  async listAppointments(from?: string, to?: string, masterId?: string, user?: JwtUserPayload) {
    const where: Record<string, unknown> = {};
    if (masterId?.trim()) where.masterId = masterId.trim();
    const scopedMasterId = this.masterIdForUser(user);
    if (scopedMasterId) where.masterId = scopedMasterId;
    let fromDate = from ? parseDateTime(from) : null;
    let toDate = to ? parseDateTime(to) : null;
    if (!fromDate && !toDate) {
      const now = new Date();
      fromDate = new Date(now);
      fromDate.setUTCDate(fromDate.getUTCDate() - 14);
      toDate = new Date(now);
      toDate.setUTCDate(toDate.getUTCDate() + 90);
    }
    where.startsAt = { gte: fromDate ?? undefined, lte: toDate ?? undefined };

    const config = await this.loadCrmConfig();
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
    }).then((rows) =>
      rows.map((a) => {
        const compliance = computeIntervalCompliance(
          a.client.visitsCount,
          a.client.lastProcedureAt,
          a.startsAt,
        );
        const salon = this.salonMeta(config, a.salonId);
        return {
          ...a,
          interval: compliance,
          salonName: salon.name,
          salonAddress: salon.address,
        };
      }),
    );
  }

  async updateAppointmentStatus(id: string, visitStatus: CrmVisitStatus) {
    const prev = await this.prisma.crmAppointment.findUnique({
      where: { id },
      include: { client: { select: { fullName: true } } },
    });
    if (!prev) throw new NotFoundException('Запись не найдена');

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

    if (visitStatus === CrmVisitStatus.CANCELED && prev.visitStatus !== CrmVisitStatus.CANCELED) {
      await this.notifications.appointmentCanceled({
        clientName: prev.client.fullName,
        startsAt: prev.startsAt.toISOString(),
      });
    }

    return appt;
  }

  async deleteAppointment(id: string) {
    const prev = await this.prisma.crmAppointment.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('Запись не найдена');
    await this.prisma.crmAppointment.delete({ where: { id } });
    return { ok: true };
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
          minIntervalDays: minIntervalDaysForSequence(c.visitsCount + 1),
          daysSinceLast: c.lastProcedureAt ? daysBetween(c.lastProcedureAt, today) : null,
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
    const masters =
      masterIds.length ?
        await this.prisma.crmMaster.findMany({ where: { id: { in: masterIds } }, select: { id: true, name: true } })
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
