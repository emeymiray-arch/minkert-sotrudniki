import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { addUtcDays, startUtcMonth } from '../common/date/week';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** KPI управляющего: личные задачи в «Контроле» + KPI команды из чек-листов. */
  @Get('manager-kpi')
  managerKpi() {
    return this.analytics.managerKpiSummary(new Date());
  }

  @Get('dashboard')
  team(@Query('weekAnchor') anchor?: string) {
    const d = anchor ? new Date(anchor) : new Date();
    return this.analytics.teamDashboard(d);
  }

  @Get('employees/:employeeId/overview')
  employeeOverview(
    @Param('employeeId') employeeId: string,
    @Query('from') fromIso?: string,
    @Query('to') toIso?: string,
  ) {
    const defaultTo = new Date();
    const from = fromIso ? new Date(fromIso) : addUtcDays(defaultTo, -56);
    const to = toIso ? new Date(toIso) : defaultTo;
    return this.analytics.employeeRangeAnalytics(employeeId, from, to);
  }

  @Get('heatmap')
  heatmap(@Query('from') fromIso?: string, @Query('to') toIso?: string) {
    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso ? new Date(fromIso) : startUtcMonth(to);
    return this.analytics.heatmap(from, to);
  }

  @Get('ranges/month')
  month(@Query('month') month?: string) {
    const md = month ? new Date(month) : new Date();
    return this.analytics.monthlyOverview(md);
  }
}
