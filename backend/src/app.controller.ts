import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

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
    };
  }

  @Public()
  @SkipThrottle()
  @Get('health')
  async health() {
    const ts = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: 'up', label: 'Minkert People API', ts };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        db: 'down',
        label: 'Minkert People API',
        ts,
      });
    }
  }
}
