import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';
import { SafeHttpExceptionFilter } from './common/filters/http-exception.filter';
import { clientIp } from './common/http/client-ip';
import { EmployeesModule } from './employees/employees.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CrmModule } from './crm/crm.module';
import { InsightsModule } from './insights/insights.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import type { Request } from 'express';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 240 }],
      getTracker: (req) => clientIp(req as Request),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AnalyticsModule,
    EmployeesModule,
    LoyaltyModule,
    CrmModule,
    InsightsModule,
    TasksModule,
    OperationsModule,
    NotificationsModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: SafeHttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
