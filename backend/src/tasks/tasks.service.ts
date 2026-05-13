import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtUserPayload } from '../auth/types/jwt-user';
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

  async list(employeeId: string) {
    await this.ensureEmployee(employeeId);
    return this.prisma.task.findMany({
      where: { employeeId },
      orderBy: [{ taskDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(employeeId: string, dto: CreateTaskDto, user?: JwtUserPayload) {
    this.ensureWriteRole(user);
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
    this.ensureWriteRole(user);
    const current = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!current) throw new NotFoundException('Задача не найдена');
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

  private async ensureEmployee(id: string) {
    const e = await this.prisma.employee.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Сотрудник не найден');
    return e;
  }
}
