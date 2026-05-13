import { Module } from '@nestjs/common';
import { EmployeeTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [EmployeeTasksController, TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
