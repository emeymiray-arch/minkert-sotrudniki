import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkEmployeesDto } from './dto/bulk-employees.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() q: QueryEmployeesDto) {
    return this.employees.findManyFiltered(q);
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
