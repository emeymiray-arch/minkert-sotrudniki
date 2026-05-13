import { Controller, Get, Param, Query } from '@nestjs/common';
import { addUtcDays, startUtcMonth } from '../common/date/week';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

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
