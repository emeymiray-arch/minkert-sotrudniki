import { Module } from '@nestjs/common';
import { EmployeeTasksController, TasksController } from './tasks.controller';
import { PublicEmployeeTasksController } from './public-employee-tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [EmployeeTasksController, TasksController, PublicEmployeeTasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
