import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { OptionalDayStatusesDto } from './day-status.dto';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /** Дата «якоря» недели (обычно понедельник) */
  @Type(() => Date)
  @IsDate()
  taskDate!: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalDayStatusesDto)
  days?: OptionalDayStatusesDto;
}
