import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Напоминания о записях — не зависят от того, зашёл ли кто-то в приложение. */
  @Cron(CronExpression.EVERY_MINUTE)
  async runAppointmentReminders() {
    try {
      await this.notifications.scanAppointmentReminders();
    } catch (err) {
      this.logger.error(
        'scanAppointmentReminders failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }

  /** Удаление просроченных refresh-токенов — меньше мусора в БД. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredRefreshTokens() {
    try {
      const res = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (res.count > 0) {
        this.logger.log(`Удалено просроченных refresh-токенов: ${res.count}`);
      }
    } catch (err) {
      this.logger.error(
        'purgeExpiredRefreshTokens failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
