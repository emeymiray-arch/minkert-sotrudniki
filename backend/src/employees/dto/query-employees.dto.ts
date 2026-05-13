import { EmployeeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryEmployeesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  sort?: 'nameAsc' | 'nameDesc' | 'createdAsc' | 'createdDesc';

  /** Понедельник недели, для которого считаем KPI в списке (ISO `YYYY-MM-DD`) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  weekAnchor?: Date;
}
