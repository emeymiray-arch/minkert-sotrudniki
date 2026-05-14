import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DiaryLineState, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LINE_COUNT = 8;
const MAX_LINES = 15;

function parseDayParam(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw?.trim() ?? '');
  if (!m) throw new BadRequestException('Дата должна быть в формате YYYY-MM-DD');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new BadRequestException('Некорректная дата');
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

function normState(s: unknown): DiaryLineState {
  if (s === DiaryLineState.CHECK || s === 'CHECK') return DiaryLineState.CHECK;
  if (s === DiaryLineState.CROSS || s === 'CROSS') return DiaryLineState.CROSS;
  return DiaryLineState.EMPTY;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  private newToken(): string {
    return randomBytes(22).toString('base64url');
  }

  async ensureOrRotateToken(employeeId: string) {
    await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const token = this.newToken();
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { diaryToken: token },
    });
    return { token, path: `/d/${token}` };
  }

  async getMetaByToken(token: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { diaryToken: token },
      select: { name: true },
    });
    if (!emp) throw new NotFoundException('Ссылка недействительна');
    return {
      employeeName: emp.name,
      today: isoDate(new Date()),
    };
  }

  private async ensureDayWithLines(employeeId: string, date: Date) {
    let day = await this.prisma.diaryDay.findUnique({
      where: { employeeId_date: { employeeId, date } },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!day) {
      day = await this.prisma.diaryDay.create({
        data: {
          employeeId,
          date,
          lines: {
            create: Array.from({ length: DEFAULT_LINE_COUNT }, (_, i) => ({
              sortOrder: i,
              label: '',
              state: DiaryLineState.EMPTY,
            })),
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    return day;
  }

  async getPublicDay(token: string, dateRaw: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { diaryToken: token },
      select: { id: true, name: true },
    });
    if (!emp) throw new NotFoundException('Ссылка недействительна');
    const date = parseDayParam(dateRaw);
    const day = await this.ensureDayWithLines(emp.id, date);
    return {
      employeeName: emp.name,
      date: isoDate(date),
      lines: day.lines.map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        label: l.label,
        state: l.state,
      })),
    };
  }

  async savePublicDay(token: string, dateRaw: string, lines: { label: string; state: DiaryLineState }[]) {
    const emp = await this.prisma.employee.findFirst({
      where: { diaryToken: token },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException('Ссылка недействительна');
    if (!Array.isArray(lines) || lines.length > MAX_LINES) {
      throw new BadRequestException(`Не более ${MAX_LINES} строк`);
    }
    const date = parseDayParam(dateRaw);

    await this.prisma.$transaction(async (tx) => {
      const day = await tx.diaryDay.upsert({
        where: { employeeId_date: { employeeId: emp.id, date } },
        create: { employeeId: emp.id, date },
        update: {},
      });
      await tx.diaryLine.deleteMany({ where: { diaryDayId: day.id } });
      await tx.diaryLine.createMany({
        data: lines.map((row, i) => ({
          diaryDayId: day.id,
          sortOrder: i,
          label: (row.label ?? '').slice(0, 400),
          state: normState(row.state),
        })),
      });
    });

    return this.getPublicDay(token, dateRaw);
  }

  async listDaysForEmployee(employeeId: string, fromRaw: string, toRaw: string, user?: JwtUserPayload) {
    if (user?.role === UserRole.VIEWER && user.linkedEmployeeId !== employeeId) {
      throw new ForbiddenException('Нет доступа к дневнику этого сотрудника');
    }
    const from = parseDayParam(fromRaw);
    const to = parseDayParam(toRaw);
    if (from.getTime() > to.getTime()) throw new BadRequestException('from позже to');
    const maxMs = 90 * 86400000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new BadRequestException('Интервал не более 90 дней');
    }

    const days = await this.prisma.diaryDay.findMany({
      where: {
        employeeId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'desc' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    return {
      from: isoDate(from),
      to: isoDate(to),
      days: days.map((d) => ({
        date: isoDate(d.date),
        lines: d.lines.map((l) => ({
          id: l.id,
          sortOrder: l.sortOrder,
          label: l.label,
          state: l.state,
        })),
      })),
    };
  }
}
