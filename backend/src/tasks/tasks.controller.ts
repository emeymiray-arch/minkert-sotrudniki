import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { CreateTaskDto } from './dto/create-task.dto';
import { RolloverWeekDto } from './dto/rollover-week.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('employees/:employeeId/tasks')
export class EmployeeTasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Param('employeeId') employeeId: string, @Query('week') week?: string) {
    return this.tasks.list(employeeId, week);
  }

  @Post('rollover-week')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  rolloverWeek(
    @Param('employeeId') employeeId: string,
    @Body() dto: RolloverWeekDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.tasks.rolloverWeek(employeeId, dto.weekAnchor, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.tasks.create(employeeId, dto, user);
  }
}

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('week-board')
  weekBoard(@Query('week') week?: string) {
    if (!week?.trim())
      throw new BadRequestException('Параметр week обязателен');
    return this.tasks.listWeekBoard(week);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  patch(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.tasks.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.tasks.remove(id, user);
  }
}
