import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [NotificationsModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
