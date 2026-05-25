import { Module } from '@nestjs/common';
import { OperationsController, OperationsViewController } from './operations.controller';
import { OperationsFinanceService } from './operations-finance.service';
import { OperationsService } from './operations.service';

@Module({
  controllers: [OperationsController, OperationsViewController],
  providers: [OperationsService, OperationsFinanceService],
  exports: [OperationsService, OperationsFinanceService],
})
export class OperationsModule {}
