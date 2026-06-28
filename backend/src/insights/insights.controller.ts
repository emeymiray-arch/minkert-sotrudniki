import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { InsightsService } from './insights.service';

@Controller('insights')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('dashboard')
  dashboard() {
    return this.insights.unifiedDashboard();
  }

  @Get('ai/summary')
  aiSummary() {
    return this.insights.aiSummary();
  }

  @Get('clients/unified')
  unifiedClients(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.insights.unifiedClients(q, page, limit);
  }

  @Get('plan')
  getPlan(@Query('month') month?: string) {
    return this.insights.getPlan(month);
  }

  @Patch('plan')
  @Roles(UserRole.ADMIN)
  setPlan(
    @Body() body: { month: string; revenuePlan?: number; clientPlan?: number },
  ) {
    return this.insights.setPlan(body.month, body);
  }

  @Get('ai/director')
  aiDirector() {
    return this.insights.aiDirector();
  }

  @Get('ai/finance')
  aiFinance() {
    return this.insights.aiFinance();
  }

  @Get('ai/hr')
  aiHr() {
    return this.insights.aiHr();
  }

  @Get('ai/marketing')
  aiMarketing() {
    return this.insights.aiMarketing();
  }

  @Get('ai/operations')
  aiOperations() {
    return this.insights.aiOperations();
  }

  @Get('employees/overviews')
  employeeOverviews(@Query('ids') ids?: string) {
    const list = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.insights.batchEmployeeOverviews(list);
  }
}
