import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { utcDateToWeekDayDb, WEEK_DAY_LABEL_RU, WEEK_DAYS_DB, type WeekDayDb } from '../common/constants/days';
import { startUtcWeekMonday } from '../common/date/week';
import { clampStatus } from '../common/kpi/kpi.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { OptionalDayStatusesDto } from './dto/day-status.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

function applyDays(base: Record<string, number>, patch?: OptionalDayStatusesDto): Record<string, number> {
  const next = { ...base };
  if (!patch) return next;
  for (const k of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
    if (patch[k] !== undefined) next[k] = clampStatus(patch[k]);
  }
  return next;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureWriteRole(user?: JwtUserPayload) {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER))
      throw new ForbiddenException('Недостаточно прав для изменений');
  }

  private isViewerEditingOwnTasks(user: JwtUserPayload | undefined, taskEmployeeId: string) {
    return (
      user?.role === UserRole.VIEWER &&
      Boolean(user.linkedEmployeeId) &&
      user.linkedEmployeeId === taskEmployeeId
    );
  }

  async list(employeeId: string) {
    await this.ensureEmployee(employeeId);
    return this.prisma.task.findMany({
      where: { employeeId },
      orderBy: [{ taskDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(employeeId: string, dto: CreateTaskDto, user?: JwtUserPayload) {
    if (!this.isViewerEditingOwnTasks(user, employeeId)) {
      this.ensureWriteRole(user);
    }
    await this.ensureEmployee(employeeId);
    const taskDate = startUtcWeekMonday(dto.taskDate);
    const zeros = {
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
      sun: 0,
    };
    const merged = applyDays(zeros, dto.days);
    return this.prisma.task.create({
      data: {
        employeeId,
        title: dto.title.trim(),
        description: (dto.description ?? '').trim(),
        taskDate,
        ...merged,
      },
    });
  }

  async update(taskId: string, dto: UpdateTaskDto, user?: JwtUserPayload) {
    const current = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!current) throw new NotFoundException('Задача не найдена');

    const viewerSelf = this.isViewerEditingOwnTasks(user, current.employeeId);
    if (viewerSelf) {
      if (dto.title !== undefined || dto.description !== undefined || dto.taskDate !== undefined) {
        throw new ForbiddenException('Можно менять только отметки по дням недели');
      }
      if (dto.days === undefined) {
        throw new BadRequestException('Укажите поле days');
      }
    } else {
      this.ensureWriteRole(user);
    }

    const base = {
      mon: current.mon,
      tue: current.tue,
      wed: current.wed,
      thu: current.thu,
      fri: current.fri,
      sat: current.sat,
      sun: current.sun,
    };
    const mergedDays = dto.days !== undefined ? applyDays(base, dto.days) : base;
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        taskDate:
          dto.taskDate !== undefined && dto.taskDate !== null
            ? startUtcWeekMonday(dto.taskDate)
            : undefined,
        ...mergedDays,
      },
    });
  }

  async remove(taskId: string, user?: JwtUserPayload) {
    this.ensureWriteRole(user);
    const current = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!current) throw new NotFoundException('Задача не найдена');
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true };
  }

  /** Публичная ссылка: те же задачи недели, что задал руководитель (по diaryToken). */
  async listPublicWeekByToken(diaryToken: string, dateRaw: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { diaryToken },
      select: { id: true, name: true },
    });
    if (!emp) throw new NotFoundException('Ссылка недействительна');
    const date = this.parseDayParam(dateRaw);
    const weekMonday = startUtcWeekMonday(date);
    const dayKey = utcDateToWeekDayDb(date);
    const dayIdx = WEEK_DAYS_DB.indexOf(dayKey);
    const dayLabelRu = dayIdx >= 0 ? WEEK_DAY_LABEL_RU[dayIdx] : dayKey.toUpperCase();

    const tasks = await this.prisma.task.findMany({
      where: { employeeId: emp.id, taskDate: weekMonday },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      employeeName: emp.name,
      date: this.isoDate(date),
      weekStart: this.isoDate(weekMonday),
      dayKey,
      dayLabelRu,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        score: t[dayKey],
      })),
    };
  }

  async patchPublicTaskDayByToken(diaryToken: string, taskId: string, dateRaw: string, scoreRaw: number) {
    const emp = await this.prisma.employee.findFirst({
      where: { diaryToken },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException('Ссылка недействительна');
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.employeeId !== emp.id) throw new NotFoundException('Задача не найдена');

    const date = this.parseDayParam(dateRaw);
    const wSel = startUtcWeekMonday(date).getTime();
    const wTask = startUtcWeekMonday(task.taskDate).getTime();
    if (wSel !== wTask) throw new BadRequestException('Дата не в неделе этой задачи');

    const dayKey = utcDateToWeekDayDb(date);
    const score = clampStatus(scoreRaw);
    const patch: Record<WeekDayDb, number> = {
      mon: task.mon,
      tue: task.tue,
      wed: task.wed,
      thu: task.thu,
      fri: task.fri,
      sat: task.sat,
      sun: task.sun,
    };
    patch[dayKey] = score;
    return this.prisma.task.update({
      where: { id: taskId },
      data: patch,
    });
  }

  private parseDayParam(raw: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw?.trim() ?? '');
    if (!m) throw new BadRequestException('Дата должна быть в формате YYYY-MM-DD');
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new BadRequestException('Некорректная дата');
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private async ensureEmployee(id: string) {
    const e = await this.prisma.employee.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Сотрудник не найден');
    return e;
  }
}
