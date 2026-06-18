import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  OpsAttendanceMark,
  OpsTaskCheckType,
  OpsTaskStatus,
  OpsTimeBlock,
  OpsViolationType,
  Prisma,
} from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { addUtcDays, startUtcWeekMonday } from '../common/date/week';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPS_DEFAULT_BLOCKS,
  OPS_DEFAULT_CATEGORY_TITLES,
  OPS_PERSISTENT_TASK_DATE_ISO,
} from './operations.constants';
import {
  checkEntryHasIssue,
  checkEntryHasStoredData,
  inferCheckTypeFromTitle,
  violationFromCheckEntry,
} from './ops-check.util';

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

  private persistentTaskDate(): Date {
    return parseDayParam(OPS_PERSISTENT_TASK_DATE_ISO);
  }

  private isPersistentDailyBlock(block: OpsTimeBlock): boolean {
    return block !== OpsTimeBlock.WEEK;
  }

  private categoryAnchorDate(block: OpsTimeBlock, forDate: Date): Date {
    return block === OpsTimeBlock.WEEK ? startUtcWeekMonday(forDate) : this.persistentTaskDate();
  }

  private taskWhereForBlock(block: OpsTimeBlock, forDate: Date): Prisma.OpsTaskWhereInput {
    if (block === OpsTimeBlock.WEEK) {
      const mon = startUtcWeekMonday(forDate);
      return { block, forDate: { gte: mon, lte: addUtcDays(mon, 6) } };
    }
    return { block, recurring: true };
  }

  /** Старые задачи «на один день» → постоянный список блока (один раз). */
  private async migrateBlockToPersistentTasks(block: OpsTimeBlock) {
    if (!this.isPersistentDailyBlock(block)) return;
    const recurringCount = await this.prisma.opsTask.count({
      where: { block, recurring: true },
    });
    if (recurringCount > 0) return;

    const latest = await this.prisma.opsTask.findFirst({
      where: { block },
      orderBy: { forDate: 'desc' },
      select: { forDate: true },
    });
    if (!latest) return;

    const anchor = this.persistentTaskDate();
    await this.prisma.opsTask.updateMany({
      where: { block, forDate: latest.forDate },
      data: { recurring: true, forDate: anchor },
    });
  }

  private readonly taskListInclude = {
    assignee: { select: { id: true, name: true, position: true } },
  };

  private readonly taskInclude = {
    ...this.taskListInclude,
    comments: { orderBy: { createdAt: 'desc' as const }, take: 3 },
    notes: { orderBy: { updatedAt: 'desc' as const }, take: 2 },
  };

  private async applyOverdue() {
    const now = new Date();
    await this.prisma.opsTask.updateMany({
      where: {
        dueAt: { not: null, lt: now },
        status: { in: [OpsTaskStatus.PENDING, OpsTaskStatus.NOT_DONE, OpsTaskStatus.PARTIAL, OpsTaskStatus.NEEDS_ATTENTION] },
      },
      data: { status: OpsTaskStatus.OVERDUE },
    });
  }

  async ensureCategoriesForBoard(block: OpsTimeBlock, anchor: Date) {
    const count = await this.prisma.opsCategory.count({ where: { block, forDate: anchor } });
    if (count > 0) return;
    for (let i = 0; i < OPS_DEFAULT_CATEGORY_TITLES.length; i++) {
      await this.prisma.opsCategory.create({
        data: {
          block,
          forDate: anchor,
          title: OPS_DEFAULT_CATEGORY_TITLES[i]!,
          sortOrder: i,
        },
      });
    }
  }

  async getBoard(block: OpsTimeBlock, dateRaw?: string) {
    await this.ensureDefaults();
    const forDate = parseDayParam(dateRaw);
    await this.migrateBlockToPersistentTasks(block);
    await this.applyOverdue();

    const taskWhere = this.taskWhereForBlock(block, forDate);
    const rawTasks = await this.prisma.opsTask.findMany({
      where: taskWhere,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        ...this.taskListInclude,
        category: { select: { title: true } },
      },
    });

    const activeEmployees = await this.prisma.employee.count({
      where: { status: EmployeeStatus.ACTIVE },
    });
    const entries = rawTasks.length
      ? await this.prisma.opsTaskCheckEntry.findMany({
          where: { taskId: { in: rawTasks.map((t) => t.id) }, recordDate: forDate },
        })
      : [];

    const tasks = [...rawTasks]
      .sort((a, b) => {
        const la = a.categoryLabel?.trim() || a.category?.title?.trim() || 'яяя';
        const lb = b.categoryLabel?.trim() || b.category?.title?.trim() || 'яяя';
        if (la !== lb) return la.localeCompare(lb, 'ru');
        return a.sortOrder - b.sortOrder;
      })
      .map((t) => this.formatTaskForBoard(t, forDate, activeEmployees, entries));

    return {
      forDate: isoDate(forDate),
      block,
      tasks,
    };
  }

  /** Копирует журнал фиксации с одной даты на другую (например сегодня → завтра). */
  async carryForwardBoard(
    user: JwtUserPayload | undefined,
    block: OpsTimeBlock,
    fromDateRaw?: string,
    toDateRaw?: string,
    opts?: { resetTaskStatus?: boolean; onlyIncomplete?: boolean },
  ) {
    if (block === OpsTimeBlock.WEEK) {
      throw new BadRequestException('Для блока «Неделя» перенос на завтра недоступен');
    }
    const fromDate = parseDayParam(fromDateRaw);
    const toDate = toDateRaw ? parseDayParam(toDateRaw) : addUtcDays(fromDate, 1);
    if (toDate.getTime() <= fromDate.getTime()) {
      throw new BadRequestException('Дата «куда» должна быть позже даты «откуда»');
    }

    await this.migrateBlockToPersistentTasks(block);
    const taskWhere: Prisma.OpsTaskWhereInput = { block, recurring: true };
    if (opts?.onlyIncomplete) {
      taskWhere.status = { not: OpsTaskStatus.DONE };
    }
    const tasks = await this.prisma.opsTask.findMany({
      where: taskWhere,
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length === 0) {
      return {
        fromDate: isoDate(fromDate),
        toDate: isoDate(toDate),
        block,
        copied: 0,
        skipped: 0,
        tasksReset: 0,
      };
    }

    const sourceEntries = await this.prisma.opsTaskCheckEntry.findMany({
      where: { taskId: { in: taskIds }, recordDate: fromDate },
    });

    const existingTargets = await this.prisma.opsTaskCheckEntry.findMany({
      where: { taskId: { in: taskIds }, recordDate: toDate },
    });
    const existingMap = new Map(
      existingTargets.map((e) => [`${e.taskId}:${e.employeeId}`, e] as const),
    );

    let copied = 0;
    let skipped = 0;
    const recorder = user?.email ?? 'Контроль';

    for (const src of sourceEntries) {
      if (!checkEntryHasStoredData(src)) continue;

      const existing = existingMap.get(`${src.taskId}:${src.employeeId}`);
      if (existing && checkEntryHasStoredData(existing)) {
        skipped += 1;
        continue;
      }

      await this.prisma.opsTaskCheckEntry.upsert({
        where: {
          taskId_employeeId_recordDate: {
            taskId: src.taskId,
            employeeId: src.employeeId,
            recordDate: toDate,
          },
        },
        create: {
          taskId: src.taskId,
          employeeId: src.employeeId,
          recordDate: toDate,
          attendanceMark: src.attendanceMark,
          checklistOpened: src.checklistOpened,
          checklistDone: src.checklistDone,
          checklistIgnored: src.checklistIgnored,
          reportSubmitted: src.reportSubmitted,
          reportError: src.reportError,
          reportNeedsFix: src.reportNeedsFix,
          comment: src.comment,
          extraNote: src.extraNote,
          flagViolation: false,
          recordedByName: recorder,
        },
        update: {
          attendanceMark: src.attendanceMark,
          checklistOpened: src.checklistOpened,
          checklistDone: src.checklistDone,
          checklistIgnored: src.checklistIgnored,
          reportSubmitted: src.reportSubmitted,
          reportError: src.reportError,
          reportNeedsFix: src.reportNeedsFix,
          comment: src.comment,
          extraNote: src.extraNote,
          flagViolation: false,
          recordedByName: recorder,
        },
      });
      copied += 1;
    }

    let tasksReset = 0;
    if (opts?.resetTaskStatus !== false) {
      const reset = await this.prisma.opsTask.updateMany({
        where: { id: { in: taskIds } },
        data: { status: OpsTaskStatus.PENDING, markedAt: null, markedByName: '' },
      });
      tasksReset = reset.count;
    }

    await this.log(user, 'board', block, 'carry_forward', {
      fromDate: isoDate(fromDate),
      toDate: isoDate(toDate),
      copied,
      skipped,
      tasksReset,
    });

    return {
      fromDate: isoDate(fromDate),
      toDate: isoDate(toDate),
      block,
      copied,
      skipped,
      tasksReset,
    };
  }

  private effectiveCheckType(task: { checkType: OpsTaskCheckType; title: string }): OpsTaskCheckType {
    return task.checkType === OpsTaskCheckType.NONE ?
        inferCheckTypeFromTitle(task.title)
      : task.checkType;
  }

  private formatTaskForBoard(
    task: {
      id: string;
      checkType: OpsTaskCheckType;
      title: string;
      categoryLabel?: string;
      category?: { title: string } | null;
      [key: string]: unknown;
    },
    recordDate: Date,
    activeEmployees: number,
    entries: Array<{ taskId: string } & Record<string, unknown>>,
  ) {
    const checkType = this.effectiveCheckType(task);
    const taskEntries = entries.filter((e) => e.taskId === task.id);
    const categoryLabel = task.categoryLabel?.trim() || task.category?.title?.trim() || '';
    return {
      ...task,
      categoryLabel,
      checkType,
      checkJournal: {
        recordDate: isoDate(recordDate),
        activeEmployees,
        recorded: taskEntries.length,
        issues: taskEntries.filter((e) =>
          checkEntryHasIssue(e as never, checkType),
        ).length,
      },
    };
  }

  async createCategory(
    user: JwtUserPayload | undefined,
    body: { block: OpsTimeBlock; forDate?: string; title: string },
  ) {
    const forDate = parseDayParam(body.forDate);
    const anchor = this.categoryAnchorDate(body.block, forDate);
    const max = await this.prisma.opsCategory.aggregate({
      where: { block: body.block, forDate: anchor },
      _max: { sortOrder: true },
    });
    const cat = await this.prisma.opsCategory.create({
      data: {
        block: body.block,
        forDate: anchor,
        title: body.title.trim(),
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    await this.log(user, 'category', cat.id, 'create', { title: cat.title });
    return cat;
  }

  async updateCategory(
    user: JwtUserPayload | undefined,
    id: string,
    body: Partial<{ title: string; pinned: boolean; sortOrder: number }>,
  ) {
    const cat = await this.prisma.opsCategory.update({ where: { id }, data: body });
    await this.log(user, 'category', id, 'update', body as Prisma.InputJsonValue);
    return cat;
  }

  async deleteCategory(user: JwtUserPayload | undefined, id: string) {
    await this.prisma.opsCategory.delete({ where: { id } });
    await this.log(user, 'category', id, 'delete');
    return { ok: true };
  }

  async reorderCategories(user: JwtUserPayload | undefined, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, sortOrder) =>
        this.prisma.opsCategory.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    await this.log(user, 'category', 'batch', 'reorder', { orderedIds });
    return { ok: true };
  }

  async listTasks(block: OpsTimeBlock, dateRaw?: string) {
    await this.ensureDefaults();
    const forDate = parseDayParam(dateRaw);
    await this.migrateBlockToPersistentTasks(block);
    await this.applyOverdue();
    const where = this.taskWhereForBlock(block, forDate);
    const items = await this.prisma.opsTask.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: this.taskListInclude,
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
      categoryId?: string | null;
      categoryLabel?: string;
      checkType?: OpsTaskCheckType;
    },
  ) {
    const viewDate = parseDayParam(body.forDate);
    const persistent = this.isPersistentDailyBlock(body.block);
    const forDate = persistent ? this.persistentTaskDate() : viewDate;
    const checkType = body.checkType ?? inferCheckTypeFromTitle(body.title);
    const taskWhere = body.categoryId
      ? { categoryId: body.categoryId }
      : this.taskWhereForBlock(body.block, viewDate);
    const max = await this.prisma.opsTask.aggregate({
      where: taskWhere,
      _max: { sortOrder: true },
    });
    const task = await this.prisma.opsTask.create({
      data: {
        block: body.block,
        categoryId: body.categoryId || null,
        categoryLabel: body.categoryLabel?.trim() ?? '',
        title: body.title.trim(),
        description: body.description?.trim() ?? '',
        forDate,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        assigneeId: body.assigneeId || null,
        pinned: body.pinned ?? false,
        recurring: persistent ? true : (body.recurring ?? false),
        templateKey: body.templateKey ?? null,
        checkType,
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
      categoryId: string | null;
      categoryLabel: string;
      checkType: OpsTaskCheckType;
    }>,
  ) {
    const prev = await this.prisma.opsTask.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('Задача не найдена');
    const data: Prisma.OpsTaskUpdateInput = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.checkType !== undefined) data.checkType = body.checkType;
    else if (body.title !== undefined && prev.checkType === OpsTaskCheckType.NONE) {
      data.checkType = inferCheckTypeFromTitle(body.title);
    }
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.assigneeId !== undefined) {
      data.assignee = body.assigneeId ? { connect: { id: body.assigneeId } } : { disconnect: true };
    }
    if (body.pinned !== undefined) data.pinned = body.pinned;
    if (body.block !== undefined) data.block = body.block;
    if (body.forDate !== undefined) data.forDate = parseDayParam(body.forDate);
    if (body.categoryId !== undefined) {
      data.category = body.categoryId ? { connect: { id: body.categoryId } } : { disconnect: true };
    }
    if (body.categoryLabel !== undefined) data.categoryLabel = body.categoryLabel.trim();
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
      categoryId: src.categoryId,
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
        authorName: user?.email ?? 'Контроль',
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
    await this.applyOverdue();
    for (const block of [
      OpsTimeBlock.MORNING,
      OpsTimeBlock.DAY,
      OpsTimeBlock.EVENING,
      OpsTimeBlock.NEXT_DAY,
    ]) {
      await this.migrateBlockToPersistentTasks(block);
    }
    const tasks = await this.prisma.opsTask.findMany({
      where: {
        recurring: true,
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

  async listProblems() {
    return this.prisma.opsProblem.findMany({
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createProblem(user: JwtUserPayload | undefined, body: { title: string; description?: string }) {
    const row = await this.prisma.opsProblem.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() ?? '',
      },
    });
    await this.log(user, 'problem', row.id, 'create', { title: row.title });
    return row;
  }

  async updateProblem(
    user: JwtUserPayload | undefined,
    id: string,
    body: Partial<{ title: string; description: string; resolved: boolean }>,
  ) {
    const data: Prisma.OpsProblemUpdateInput = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.resolved !== undefined) {
      data.resolved = body.resolved;
      data.resolvedAt = body.resolved ? new Date() : null;
    }
    const row = await this.prisma.opsProblem.update({ where: { id }, data });
    await this.log(user, 'problem', row.id, 'update', body as Prisma.InputJsonValue);
    return row;
  }

  async deleteProblem(user: JwtUserPayload | undefined, id: string) {
    await this.prisma.opsProblem.delete({ where: { id } });
    await this.log(user, 'problem', id, 'delete');
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

  async getCheckSheet(taskId: string, dateRaw?: string) {
    const task = await this.prisma.opsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Задача не найдена');
    const recordDate = parseDayParam(dateRaw ?? isoDate(task.forDate));
    const checkType = this.effectiveCheckType(task);
    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, position: true },
    });
    const entries = await this.prisma.opsTaskCheckEntry.findMany({
      where: { taskId, recordDate },
    });
    const byEmp = new Map(entries.map((e) => [e.employeeId, e]));
    return {
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        checkType,
        forDate: isoDate(task.forDate),
      },
      recordDate: isoDate(recordDate),
      rows: employees.map((emp) => ({
        employee: emp,
        entry: byEmp.get(emp.id) ?? null,
      })),
    };
  }

  async saveCheckSheet(
    user: JwtUserPayload | undefined,
    taskId: string,
    dateRaw: string | undefined,
    rows: Array<{
      employeeId: string;
      attendanceMark?: OpsAttendanceMark | null;
      checklistOpened?: boolean | null;
      checklistDone?: boolean | null;
      checklistIgnored?: boolean | null;
      reportSubmitted?: boolean | null;
      reportError?: boolean | null;
      reportNeedsFix?: boolean | null;
      comment?: string;
      extraNote?: string;
      flagViolation?: boolean;
    }>,
  ) {
    const task = await this.prisma.opsTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Задача не найдена');
    const recordDate = parseDayParam(dateRaw ?? isoDate(task.forDate));
    const checkType = this.effectiveCheckType(task);
    const recorder = user?.email ?? 'Контроль';

    for (const row of rows) {
      const hasData =
        row.attendanceMark != null ||
        row.checklistOpened != null ||
        row.checklistDone != null ||
        row.checklistIgnored != null ||
        row.reportSubmitted != null ||
        row.reportError != null ||
        row.reportNeedsFix != null ||
        (row.comment?.trim()?.length ?? 0) > 0 ||
        (row.extraNote?.trim()?.length ?? 0) > 0;

      if (!hasData) {
        await this.prisma.opsTaskCheckEntry.deleteMany({
          where: { taskId, employeeId: row.employeeId, recordDate },
        });
        continue;
      }

      const entry = await this.prisma.opsTaskCheckEntry.upsert({
        where: {
          taskId_employeeId_recordDate: {
            taskId,
            employeeId: row.employeeId,
            recordDate,
          },
        },
        create: {
          taskId,
          employeeId: row.employeeId,
          recordDate,
          attendanceMark: row.attendanceMark ?? null,
          checklistOpened: row.checklistOpened ?? null,
          checklistDone: row.checklistDone ?? null,
          checklistIgnored: row.checklistIgnored ?? null,
          reportSubmitted: row.reportSubmitted ?? null,
          reportError: row.reportError ?? null,
          reportNeedsFix: row.reportNeedsFix ?? null,
          comment: row.comment?.trim() ?? '',
          extraNote: row.extraNote?.trim() ?? '',
          flagViolation: row.flagViolation ?? false,
          recordedByName: recorder,
        },
        update: {
          attendanceMark: row.attendanceMark ?? null,
          checklistOpened: row.checklistOpened ?? null,
          checklistDone: row.checklistDone ?? null,
          checklistIgnored: row.checklistIgnored ?? null,
          reportSubmitted: row.reportSubmitted ?? null,
          reportError: row.reportError ?? null,
          reportNeedsFix: row.reportNeedsFix ?? null,
          comment: row.comment?.trim() ?? '',
          extraNote: row.extraNote?.trim() ?? '',
          flagViolation: row.flagViolation ?? false,
          recordedByName: recorder,
        },
      });

      if (row.flagViolation) {
        const v = violationFromCheckEntry(entry, checkType);
        if (v) {
          await this.prisma.opsViolation.create({
            data: {
              employeeId: row.employeeId,
              type: v.type,
              description: v.description,
              occurredAt: new Date(),
              warned: row.flagViolation ?? false,
            },
          });
        }
      }
    }

    await this.log(user, 'task', taskId, 'check_sheet_save', { recordDate: isoDate(recordDate), rows: rows.length });
    return this.getCheckSheet(taskId, isoDate(recordDate));
  }

  async getCheckJournal(opts: {
    employeeId?: string;
    from?: string;
    to?: string;
    checkType?: OpsTaskCheckType;
  }) {
    const to = parseDayParam(opts.to);
    const from = opts.from ? parseDayParam(opts.from) : new Date(to.getTime() - 30 * 86400000);
    const where: Prisma.OpsTaskCheckEntryWhereInput = {
      recordDate: { gte: from, lte: to },
    };
    if (opts.employeeId) where.employeeId = opts.employeeId;

    const entries = await this.prisma.opsTaskCheckEntry.findMany({
      where,
      orderBy: [{ recordDate: 'desc' }, { updatedAt: 'desc' }],
      include: {
        employee: { select: { id: true, name: true, position: true } },
        task: { select: { id: true, title: true, block: true, checkType: true } },
      },
    });

    const filtered =
      opts.checkType ?
        entries.filter((e) => this.effectiveCheckType(e.task) === opts.checkType)
      : entries;

    return {
      from: isoDate(from),
      to: isoDate(to),
      items: filtered.map((e) => ({
        ...e,
        effectiveCheckType: this.effectiveCheckType(e.task),
        hasIssue: checkEntryHasIssue(e, this.effectiveCheckType(e.task)),
      })),
    };
  }
}
