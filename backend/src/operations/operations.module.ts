import { Module } from '@nestjs/common';
import {
  OperationsController,
  OperationsViewController,
} from './operations.controller';
import { FinanceController } from './finance.controller';
import { OperationsFinanceService } from './operations-finance.service';
import { OperationsService } from './operations.service';

@Module({
  controllers: [
    OperationsController,
    OperationsViewController,
    FinanceController,
  ],
  providers: [OperationsService, OperationsFinanceService],
  exports: [OperationsService, OperationsFinanceService],
})
export class OperationsModule {}
