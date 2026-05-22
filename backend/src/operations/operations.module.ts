import { Module } from '@nestjs/common';
import { OperationsController, OperationsViewController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  controllers: [OperationsController, OperationsViewController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
