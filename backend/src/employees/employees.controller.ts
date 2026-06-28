import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { DiaryService } from '../diary/diary.service';
import { BulkEmployeesDto } from './dto/bulk-employees.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpsertDailyLogDto } from './dto/upsert-daily-log.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly diary: DiaryService,
  ) {}

  @Get()
  list(@Query() q: QueryEmployeesDto) {
    return this.employees.findManyFiltered(q);
  }

  @Get('daily-board')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  dailyBoard(
    @Query('date') date?: string,
    @Query('weekAnchor') weekAnchor?: string,
  ) {
    return this.employees.getDailyBoard(date, weekAnchor);
  }

  @Get(':id/daily-logs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  listDailyLogs(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('Укажите from и to в формате YYYY-MM-DD');
    }
    return this.employees.listDailyLogs(id, from.trim(), to.trim());
  }

  @Put(':id/daily-log')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  upsertDailyLog(@Param('id') id: string, @Body() dto: UpsertDailyLogDto) {
    return this.employees.upsertDailyLog(id, dto);
  }

  @Delete(':id/daily-log/:date')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deleteDailyLog(@Param('id') id: string, @Param('date') date: string) {
    return this.employees.deleteDailyLog(id, date);
  }

  @Get(':id/diary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  getDiary(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    if (user.role === UserRole.VIEWER && user.linkedEmployeeId !== id) {
      throw new ForbiddenException('Нет доступа к дневнику этого сотрудника');
    }
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('Укажите from и to в формате YYYY-MM-DD');
    }
    return this.diary.listDaysForEmployee(id, from.trim(), to.trim(), user);
  }

  @Post(':id/diary-token')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  rotateDiaryToken(@Param('id') id: string) {
    return this.diary.ensureOrRotateToken(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employees.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }

  @Post('bulk-patch')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  bulkPatch(@Body() dto: BulkEmployeesDto) {
    return this.employees.bulkPatch({ patches: dto.patches });
  }
}
