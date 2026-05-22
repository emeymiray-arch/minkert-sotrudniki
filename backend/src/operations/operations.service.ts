import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OpsTaskStatus,
  OpsTimeBlock,
  OpsViolationType,
  Prisma,
} from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { startUtcWeekMonday } from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';
import { OPS_DEFAULT_BLOCKS } from './operations.constants';

function parseDayParam(raw?: string): Date {
  if (!raw?.trim()) {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new BadRequestException('Дата: YYYY-MM-DD');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async log(
    user: JwtUserPayload | undefined,
    entityType: string,
    entityId: string,
    action: string,
    payload?: Prisma.InputJsonValue,
  ) {
    await this.prisma.opsActivityLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId: user?.sub,
        userName: user?.email ?? '',
        payload: payload ?? undefined,
      },
    });
  }

  async ensureDefaults() {
    const count = await this.prisma.opsBlockConfig.count();
    if (count > 0) return;
    for (const b of OPS_DEFAULT_BLOCKS) {
      await this.prisma.opsBlockConfig.create({ data: b });
    }
    await this.prisma.opsSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  async listBlocks() {
    await this.ensureDefaults();
    return this.prisma.opsBlockConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async updateBlock(block: OpsTimeBlock, data: Partial<{ title: string; timeStart: string; timeEnd: string; enabled: boolean; sortOrder: number }>, user?: JwtUserPayload) {
    await this.ensureDefaults();
    const row = await this.prisma.opsBlockConfig.update({
      where: { block },
      data,
    });
    await this.log(user, 'block', block, 'update', data as Prisma.InputJsonValue);
    return row;
  }

  private async applyOverdue(forDate: Date) {
    const now = new Date();
    await this.prisma.opsTask.updateMany({
      where: {
        forDate,
        dueAt: { lt: now },
        status: { in: [OpsTaskStatus.PENDING, OpsTaskStatus.NOT_DONE, OpsTaskStatus.PARTIAL, OpsTaskStatus.NEEDS_ATTENTION] },
      },
      data: { status: OpsTaskStatus.OVERDUE },
    });
  }

  async listTasks(block: OpsTimeBlock, dateRaw?: string) {
    await this.ensureDefaults();
    const forDate = parseDayParam(dateRaw);
    await this.applyOverdue(forDate);
    const where: Prisma.OpsTaskWhereInput = { block, forDate };
    if (block === OpsTimeBlock.WEEK) {
      const mon = startUtcWeekMonday(forDate);
      const sun = new Date(mon);
      sun.setUTCDate(sun.getUTCDate() + 6);
      where.forDate = { gte: mon, lte: sun };
      delete (where as { block?: OpsTimeBlock }).block;
      where.block = OpsTimeBlock.WEEK;
    }
    const items = await this.prisma.opsTask.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        assignee: { select: { id: true, name: true, position: true } },
        comments: { orderBy: { createdAt: 'desc' }, take: 5 },
        notes: { orderBy: { updatedAt: 'desc' }, take: 3 },
      },
    });
    return { forDate: isoDate(forDate), block, items };
  }

  async createTask(
    user: JwtUserPayload | undefined,
    body: {
      block: OpsTimeBlock;
      title: string;
      description?: string;
      forDate?: string;
      dueAt?: string | null;
      assigneeId?: string | null;
      pinned?: boolean;
      recurring?: boolean;
      templateKey?: string | null;
    },
  ) {
    const forDate = parseDayParam(body.forDate);
    const max = await this.prisma.opsTask.aggregate({
      where: { block: body.block, forDate },
      _max: { sortOrder: true },
    });
    const task = await this.prisma.opsTask.create({
      data: {
        block: body.block,
        title: body.title.trim(),
        description: body.description?.trim() ?? '',
        forDate,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assigneeId: body.assigneeId || null,
        pinned: body.pinned ?? false,
        recurring: body.recurring ?? false,
        templateKey: body.templateKey ?? null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
    await this.log(user, 'task', task.id, 'create', { title: task.title, block: task.block });
    return task;
  }

  async updateTask(
    user: JwtUserPayload | undefined,
    id: string,
    body: Partial<{
      title: string;
      description: string;
      status: OpsTaskStatus;
      dueAt: string | null;
      assigneeId: string | null;
      pinned: boolean;
      block: OpsTimeBlock;
      forDate: string;
    }>,
  ) {
    const prev = await this.prisma.opsTask.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('Задача не найдена');
    const data: Prisma.OpsTaskUpdateInput = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.assigneeId !== undefined) {
      data.assignee = body.assigneeId ? { connect: { id: body.assigneeId } } : { disconnect: true };
    }
    if (body.pinned !== undefined) data.pinned = body.pinned;
    if (body.block !== undefined) data.block = body.block;
    if (body.forDate !== undefined) data.forDate = parseDayParam(body.forDate);
    if (body.status !== undefined) {
      data.status = body.status;
      data.markedAt = new Date();
      data.markedByName = user?.email ?? 'Система';
    }
    const task = await this.prisma.opsTask.update({
      where: { id },
      data,
      include: { assignee: { select: { id: true, name: true } }, comments: true, notes: true },
    });
    await this.log(user, 'task', id, 'update', body as Prisma.InputJsonValue);
    return task;
  }

  async deleteTask(user: JwtUserPayload | undefined, id: string) {
    const prev = await this.prisma.opsTask.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('Задача не найдена');
    await this.prisma.opsTask.delete({ where: { id } });
    await this.log(user, 'task', id, 'delete', { title: prev.title });
    return { ok: true };
  }

  async reorderTasks(user: JwtUserPayload | undefined, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, sortOrder) =>
        this.prisma.opsTask.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    await this.log(user, 'task', 'batch', 'reorder', { orderedIds });
    return { ok: true };
  }

  async duplicateTask(user: JwtUserPayload | undefined, id: string) {
    const src = await this.prisma.opsTask.findUnique({ where: { id } });
    if (!src) throw new NotFoundException('Задача не найдена');
    return this.createTask(user, {
      block: src.block,
      title: `${src.title} (копия)`,
      description: src.description,
      forDate: isoDate(src.forDate),
      assigneeId: src.assigneeId,
      pinned: src.pinned,
      recurring: src.recurring,
      templateKey: src.templateKey,
    });
  }

  async moveTask(user: JwtUserPayload | undefined, id: string, block: OpsTimeBlock, forDate?: string) {
    return this.updateTask(user, id, { block, forDate });
  }

  async addComment(user: JwtUserPayload | undefined, taskId: string, body: string) {
    const c = await this.prisma.opsTaskComment.create({
      data: {
        taskId,
        userId: user?.sub,
        authorName: user?.email ?? 'Управляющая',
        body: body.trim(),
      },
    });
    await this.log(user, 'task', taskId, 'comment', { body: c.body });
    return c;
  }

  async addNote(user: JwtUserPayload | undefined, taskId: string, body: string) {
    const n = await this.prisma.opsTaskNote.create({
      data: { taskId, body: body.trim() },
    });
    await this.log(user, 'task', taskId, 'note', { body: n.body });
    return n;
  }

  async taskHistory(taskId: string) {
    return this.prisma.opsActivityLog.findMany({
      where: { entityType: 'task', entityId: taskId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async dashboard(dateRaw?: string) {
    await this.ensureDefaults();
    const forDate = parseDayParam(dateRaw);
    await this.applyOverdue(forDate);
    const tasks = await this.prisma.opsTask.findMany({
      where: {
        forDate,
        block: { not: OpsTimeBlock.WEEK },
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === OpsTaskStatus.DONE).length;
    const notDone = tasks.filter((t) => t.status === OpsTaskStatus.NOT_DONE).length;
    const overdue = tasks.filter((t) => t.status === OpsTaskStatus.OVERDUE).length;
    const needsAttention = tasks.filter((t) => t.status === OpsTaskStatus.NEEDS_ATTENTION).length;
    const completionPercent = total ? Math.round((done / total) * 100) : 0;

    const violationsToday = await this.prisma.opsViolation.findMany({
      where: {
        occurredAt: {
          gte: forDate,
          lt: new Date(forDate.getTime() + 86400000),
        },
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    });

    const missedReports = await this.prisma.opsReportLog.findMany({
      where: { reportDate: forDate, status: { in: ['MISSED', 'PENDING'] } },
      include: { employee: { select: { id: true, name: true } } },
      take: 10,
    });

    const recentComments = await this.prisma.opsTaskComment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { task: { select: { id: true, title: true, block: true } } },
    });

    const recentActivity = await this.prisma.opsActivityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const urgent = tasks.filter(
      (t) =>
        t.pinned ||
        t.status === OpsTaskStatus.OVERDUE ||
        t.status === OpsTaskStatus.NEEDS_ATTENTION,
    );

    const repeatViolators = await this.prisma.opsViolation.groupBy({
      by: ['employeeId'],
      _count: { id: true },
      where: {
        occurredAt: { gte: new Date(forDate.getTime() - 30 * 86400000) },
      },
      having: { id: { _count: { gt: 2 } } },
    });
    const repeatIds = repeatViolators.map((r) => r.employeeId);
    const repeatEmployees =
      repeatIds.length ?
        await this.prisma.employee.findMany({
          where: { id: { in: repeatIds } },
          select: { id: true, name: true },
        })
      : [];

    return {
      forDate: isoDate(forDate),
      stats: { total, done, notDone, overdue, needsAttention, completionPercent },
      urgentTasks: urgent.slice(0, 8),
      violationsToday,
      missedReports,
      recentComments,
      recentActivity,
      repeatViolators: repeatEmployees,
    };
  }

  async listStaff() {
    const employees = await this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
      include: {
        opsProfile: true,
        _count: { select: { opsViolations: true, opsTasks: true } },
      },
    });
    return { items: employees };
  }

  async getStaff(employeeId: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        opsProfile: true,
        opsViolations: { orderBy: { occurredAt: 'desc' }, take: 20 },
      },
    });
    if (!emp) throw new NotFoundException('Сотрудник не найден');
    const forDate = parseDayParam();
    const tasks = await this.prisma.opsTask.findMany({
      where: { assigneeId: employeeId, forDate },
    });
    const done = tasks.filter((t) => t.status === OpsTaskStatus.DONE).length;
    return {
      employee: emp,
      todayTasks: { total: tasks.length, done, pending: tasks.length - done },
    };
  }

  async upsertStaffProfile(
    employeeId: string,
    data: Partial<{
      schedule: string;
      disciplineLevel: number;
      warningsCount: number;
      preferences: string;
      workStyle: string;
      traits: string;
      managerNotes: string;
      clientAttitude: string;
      qualityNotes: string;
    }>,
    user?: JwtUserPayload,
  ) {
    await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const row = await this.prisma.opsStaffProfile.upsert({
      where: { employeeId },
      create: { employeeId, ...data },
      update: data,
    });
    await this.log(user, 'staff', employeeId, 'profile_update', data as Prisma.InputJsonValue);
    return row;
  }

  async listViolations(fromRaw?: string, toRaw?: string) {
    const to = parseDayParam(toRaw);
    const from = fromRaw ? parseDayParam(fromRaw) : new Date(to.getTime() - 30 * 86400000);
    return this.prisma.opsViolation.findMany({
      where: { occurredAt: { gte: from, lte: new Date(to.getTime() + 86400000) } },
      orderBy: { occurredAt: 'desc' },
      include: { employee: { select: { id: true, name: true, position: true } } },
    });
  }

  async createViolation(
    user: JwtUserPayload | undefined,
    body: { employeeId: string; type?: OpsViolationType; description?: string; occurredAt?: string; warned?: boolean },
  ) {
    const v = await this.prisma.opsViolation.create({
      data: {
        employeeId: body.employeeId,
        type: body.type ?? OpsViolationType.OTHER,
        description: body.description?.trim() ?? '',
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        warned: body.warned ?? false,
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    const prof = await this.prisma.opsStaffProfile.findUnique({ where: { employeeId: body.employeeId } });
    if (prof) {
      await this.prisma.opsStaffProfile.update({
        where: { employeeId: body.employeeId },
        data: {
          warningsCount: prof.warningsCount + (body.warned ? 1 : 0),
          disciplineLevel: Math.max(0, prof.disciplineLevel - 5),
        },
      });
    }
    await this.log(user, 'violation', v.id, 'create', body as Prisma.InputJsonValue);
    return v;
  }

  async deleteViolation(user: JwtUserPayload | undefined, id: string) {
    await this.prisma.opsViolation.delete({ where: { id } });
    await this.log(user, 'violation', id, 'delete');
    return { ok: true };
  }

  async listContentReviews(reviewDateRaw?: string) {
    const reviewDate = parseDayParam(reviewDateRaw);
    return this.prisma.opsContentReview.findMany({
      where: { reviewDate },
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { id: true, name: true, position: true } } },
    });
  }

  async upsertContentReview(
    user: JwtUserPayload | undefined,
    body: {
      id?: string;
      employeeId: string;
      roleType?: 'STORY' | 'REEL';
      title?: string;
      reviewDate?: string;
      reach?: number;
      engagement?: number;
      views?: number;
      visualScore?: number;
      brandMatch?: boolean;
      qualityNote?: string;
      checked?: boolean;
    },
  ) {
    const reviewDate = parseDayParam(body.reviewDate);
    if (body.id) {
      return this.prisma.opsContentReview.update({
        where: { id: body.id },
        data: {
          reach: body.reach,
          engagement: body.engagement,
          views: body.views,
          visualScore: body.visualScore,
          brandMatch: body.brandMatch,
          qualityNote: body.qualityNote,
          checked: body.checked,
        },
      });
    }
    const row = await this.prisma.opsContentReview.create({
      data: {
        employeeId: body.employeeId,
        roleType: body.roleType ?? 'STORY',
        title: body.title ?? '',
        reviewDate,
        reach: body.reach,
        engagement: body.engagement,
        views: body.views,
        visualScore: body.visualScore,
        brandMatch: body.brandMatch,
        qualityNote: body.qualityNote ?? '',
        checked: body.checked ?? false,
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    await this.log(user, 'content', row.id, 'create');
    return row;
  }

  async listReports(dateRaw?: string) {
    const reportDate = parseDayParam(dateRaw);
    return this.prisma.opsReportLog.findMany({
      where: { reportDate },
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { id: true, name: true } } },
    });
  }

  async ingestReport(body: {
    formKey: string;
    employeeId?: string;
    reportDate?: string;
    payload?: Prisma.InputJsonValue;
    status?: 'SUBMITTED' | 'MISSED' | 'ERROR';
    errorNote?: string;
  }) {
    const reportDate = parseDayParam(body.reportDate);
    return this.prisma.opsReportLog.create({
      data: {
        formKey: body.formKey,
        employeeId: body.employeeId ?? null,
        reportDate,
        payload: body.payload,
        status: body.status ?? 'SUBMITTED',
        errorNote: body.errorNote ?? '',
        submittedAt: body.status === 'SUBMITTED' ? new Date() : null,
      },
    });
  }

  async getSettings() {
    await this.ensureDefaults();
    return this.prisma.opsSettings.findUniqueOrThrow({ where: { id: 'default' } });
  }

  async updateSettings(
    user: JwtUserPayload | undefined,
    data: { googleFormMappings?: Prisma.InputJsonValue; formsWebhookNote?: string },
  ) {
    const row = await this.prisma.opsSettings.update({
      where: { id: 'default' },
      data,
    });
    await this.log(user, 'settings', 'default', 'update');
    return row;
  }

  async analyticsSummary(dateRaw?: string) {
    const forDate = parseDayParam(dateRaw);
    const monthStart = new Date(Date.UTC(forDate.getUTCFullYear(), forDate.getUTCMonth(), 1));
    const tasks = await this.prisma.opsTask.findMany({
      where: { forDate: { gte: monthStart, lte: forDate } },
    });
    const violations = await this.prisma.opsViolation.count({
      where: { occurredAt: { gte: monthStart } },
    });
    const byStatus = Object.values(OpsTaskStatus).map((status) => ({
      status,
      count: tasks.filter((t) => t.status === status).length,
    }));
    const content = await this.prisma.opsContentReview.count({
      where: { reviewDate: forDate, checked: true },
    });
    const reportsOk = await this.prisma.opsReportLog.count({
      where: { reportDate: forDate, status: 'SUBMITTED' },
    });
    const reportsMissed = await this.prisma.opsReportLog.count({
      where: { reportDate: forDate, status: { in: ['MISSED', 'PENDING'] } },
    });
    return {
      forDate: isoDate(forDate),
      monthTasks: tasks.length,
      byStatus,
      violationsMonth: violations,
      contentCheckedToday: content,
      reportsSubmitted: reportsOk,
      reportsMissed,
      placeholder: {
        bookings: null,
        sales: null,
        cancellations: null,
        clientActivity: null,
        note: 'Подключите CRM/кассу для записей и продаж',
      },
    };
  }

  async activityFeed(limit = 30) {
    return this.prisma.opsActivityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
