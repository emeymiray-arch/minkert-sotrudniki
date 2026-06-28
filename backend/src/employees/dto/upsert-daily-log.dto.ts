import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertDailyLogDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  planText?: string;

  @IsOptional()
  @IsBoolean()
  reportOnTime?: boolean;

  @IsOptional()
  @IsBoolean()
  planDone?: boolean;

  @IsOptional()
  @IsBoolean()
  noViolations?: boolean;

  @IsOptional()
  @IsBoolean()
  qualityOk?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
