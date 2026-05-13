import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { OptionalDayStatusesDto } from './day-status.dto';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  taskDate?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalDayStatusesDto)
  days?: OptionalDayStatusesDto;
}
