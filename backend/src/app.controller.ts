import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return {
      ok: true,
      service: 'Minkert People API',
      health: '/api/health',
    };
  }

  @Public()
  @Get('health')
  health() {
    return { ok: true, label: 'Minkert People API', ts: new Date().toISOString() };
  }
}
