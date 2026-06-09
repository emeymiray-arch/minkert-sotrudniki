import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { OperationsFinanceService } from './operations-finance.service';
import type { FinancePeriod } from './operations-finance.service';

@Controller('finance')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class FinanceController {
  constructor(private readonly finance: OperationsFinanceService) {}

  @Get('table')
  table(@Query('period') period: FinancePeriod, @Query('anchor') anchor?: string) {
    const p = period ?? 'month';
    return this.finance.getTable(p, anchor);
  }

  @Patch('day')
  day(
    @Body()
    body: {
      date: string;
      expenses?: number;
      clientCount?: number;
    },
  ) {
    return this.finance.upsertDay(body);
  }

  @Get('expenses')
  expenses(@Query('date') date: string) {
    return this.finance.listExpenses(date);
  }

  @Post('expenses')
  addExpense(@Body() body: { date: string; title: string; amount: number }) {
    return this.finance.addExpense(body);
  }

  @Delete('expenses/:id')
  removeExpense(@Param('id') id: string) {
    return this.finance.removeExpense(id);
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  sync(@Query('date') date?: string) {
    return this.finance.syncFromProcedures(date);
  }
}
