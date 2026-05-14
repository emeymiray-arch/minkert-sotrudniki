import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PatchPublicTaskDayDto } from './dto/patch-public-task-day.dto';
import { TasksService } from './tasks.service';

@Controller('public/employee-tasks')
export class PublicEmployeeTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Public()
  @Get(':token')
  week(
    @Param('token') token: string,
    @Query('date') date?: string,
  ) {
    const d = date?.trim() || new Date().toISOString().slice(0, 10);
    return this.tasks.listPublicWeekByToken(token, d);
  }

  @Public()
  @Patch(':token/tasks/:taskId')
  patchDay(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Body() dto: PatchPublicTaskDayDto,
  ) {
    return this.tasks.patchPublicTaskDayByToken(token, taskId, dto.date, dto.score);
  }
}
