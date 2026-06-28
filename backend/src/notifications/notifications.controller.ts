import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MASTER)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtUserPayload,
    @Query('since') since?: string,
  ) {
    await this.notifications.scanAppointmentReminders();
    return this.notifications.listForUser(user.sub, user.role, since);
  }

  @Patch('read')
  async markRead(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: { ids: string[] },
  ) {
    return this.notifications.markRead(body.ids ?? [], user.sub, user.role);
  }

  @Get('vapid-key')
  vapidKey() {
    return this.notifications.getVapidPublicKey();
  }

  @Post('push-subscribe')
  pushSubscribe(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.notifications.savePushSubscription(user.sub, body);
  }

  @Delete('push-subscribe')
  pushUnsubscribe(
    @CurrentUser() user: JwtUserPayload,
    @Query('endpoint') endpoint?: string,
  ) {
    return this.notifications.removePushSubscription(user.sub, endpoint);
  }
}
