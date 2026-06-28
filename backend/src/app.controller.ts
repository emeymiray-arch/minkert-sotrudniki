import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/decorators/public.decorator';
import { getDataCounts, getMigrationStatus } from './common/health/health.util';
import { PrismaService } from './prisma/prisma.service';

const startedAt = Date.now();

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  root() {
    return {
      ok: true,
      service: 'Minkert People API',
      health: '/api/health',
      docs: '/api/docs',
    };
  }

  @Public()
  @SkipThrottle()
  @Get('health')
  async health() {
    const ts = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const migration = await getMigrationStatus(this.prisma);
      const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

      if (migration.pending) {
        throw new ServiceUnavailableException({
          ok: false,
          db: 'up',
          migrations: 'pending',
          label: 'Minkert People API',
          ts,
        });
      }

      return {
        ok: true,
        db: 'up',
        migrations: migration.latest,
        migrationCount: migration.appliedCount,
        uptimeSec,
        version: process.env.npm_package_version ?? '0.0.1',
        label: 'Minkert People API',
        ts,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException({
        ok: false,
        db: 'down',
        label: 'Minkert People API',
        ts,
      });
    }
  }

  /** Проверка, что данные на месте (для восстановления после сбоя). */
  @Public()
  @SkipThrottle()
  @Get('health/data')
  async healthData() {
    const ts = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const [migration, counts] = await Promise.all([
        getMigrationStatus(this.prisma),
        getDataCounts(this.prisma),
      ]);

      return {
        ok: true,
        db: 'up',
        migrations: migration.latest,
        migrationCount: migration.appliedCount,
        data: counts,
        ts,
        hint:
          counts.users === 0
            ? 'База пуста — подключите дамп или создайте admin через bootstrap (только dev) / ALLOW_BOOTSTRAP'
            : 'Данные в PostgreSQL доступны',
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        db: 'down',
        ts,
      });
    }
  }
}
