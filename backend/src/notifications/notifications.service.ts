import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sendWebPush, vapidPublicKey } from './push.util';

const REMINDER_MINUTES = [120, 60, 30, 10] as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private lastReminderScan = 0;

  constructor(private readonly prisma: PrismaService) {}

  getVapidPublicKey() {
    return { publicKey: vapidPublicKey() };
  }

  async savePushSubscription(
    userId: string,
    body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    const endpoint = body.endpoint?.trim();
    if (!endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return { ok: false };
    }
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      create: {
        userId,
        endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });
    return { ok: true };
  }

  async removePushSubscription(userId: string, endpoint?: string) {
    if (endpoint?.trim()) {
      await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint: endpoint.trim() } });
    } else {
      await this.prisma.pushSubscription.deleteMany({ where: { userId } });
    }
    return { ok: true };
  }

  private async pushToRoles(roles: UserRole[], title: string, body: string) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles } },
      select: { id: true },
    });
    await Promise.all(users.map((u) => this.pushToUser(u.id, title, body)));
  }

  private async pushToUser(userId: string, title: string, body: string) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await sendWebPush(sub, { title, body });
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Push failed for ${userId}: ${String(err)}`);
          }
        }
      }),
    );
  }

  async notifyRoles(
    roles: UserRole[],
    kind: string,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ) {
    await Promise.all(
      roles.map((roleTarget) =>
        this.prisma.appNotification.create({
          data: { roleTarget, kind, title, body, payload: payload as object | undefined },
        }),
      ),
    );
    void this.pushToRoles(roles, title, body);
  }

  async notifyUser(userId: string, kind: string, title: string, body: string, payload?: Record<string, unknown>) {
    await this.prisma.appNotification.create({
      data: { userId, kind, title, body, payload: payload as object | undefined },
    });
  }

  async appointmentCreated(payload: {
    clientName: string;
    masterName?: string;
    startsAt: string;
    service: string;
    masterId?: string | null;
  }) {
    const body = `${payload.clientName} · ${payload.service} · ${new Date(payload.startsAt).toLocaleString('ru-RU')}`;
    await this.notifyRoles(
      [UserRole.ADMIN, UserRole.MANAGER, UserRole.MASTER],
      'appointment.created',
      'Новая запись',
      body,
      payload,
    );
  }

  async appointmentCanceled(payload: { clientName: string; startsAt: string; reason?: string }) {
    const body = `${payload.clientName} · ${new Date(payload.startsAt).toLocaleString('ru-RU')}`;
    await this.notifyRoles(
      [UserRole.ADMIN, UserRole.MANAGER, UserRole.MASTER],
      'appointment.canceled',
      'Отмена записи',
      body,
      payload,
    );
  }

  async listForUser(userId: string, role: UserRole, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 86_400_000);
    return this.prisma.appNotification.findMany({
      where: {
        createdAt: { gte: sinceDate },
        OR: [{ userId }, { roleTarget: role }],
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(ids: string[], userId: string, role: UserRole) {
    await this.prisma.appNotification.updateMany({
      where: {
        id: { in: ids },
        OR: [{ userId }, { roleTarget: role }],
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  /** Напоминания админу за 2ч / 1ч / 30м / 10м до процедуры. */
  async scanAppointmentReminders() {
    const now = Date.now();
    if (now - this.lastReminderScan < 45_000) return;
    this.lastReminderScan = now;

    const horizon = new Date(now + 125 * 60_000);
    const appointments = await this.prisma.crmAppointment.findMany({
      where: {
        startsAt: { gte: new Date(), lte: horizon },
        visitStatus: { in: ['SCHEDULED', 'ARRIVED'] },
      },
      include: { client: { select: { fullName: true } }, master: { select: { name: true } } },
    });

    for (const appt of appointments) {
      const diffMin = Math.round((appt.startsAt.getTime() - now) / 60_000);
      for (const target of REMINDER_MINUTES) {
        if (diffMin > target || diffMin < target - 2) continue;
        const kind = `reminder.${target}m`;
        const exists = await this.prisma.appNotification.findFirst({
          where: {
            kind,
            roleTarget: UserRole.ADMIN,
            payload: { path: ['appointmentId'], equals: appt.id },
            createdAt: { gte: new Date(now - 15 * 60_000) },
          },
        });
        if (exists) continue;

        const label =
          target === 120 ? '2 часа'
          : target === 60 ? '1 час'
          : target === 30 ? '30 минут'
          : '10 минут';

        await this.notifyRoles(
          [UserRole.ADMIN],
          kind,
          `Напоминание: через ${label}`,
          `Позвоните клиентке ${appt.client.fullName}: процедура через ${label}. Мастер: ${appt.master?.name ?? '—'}.`,
          { appointmentId: appt.id, minutes: target },
        );
      }
    }
  }
}
