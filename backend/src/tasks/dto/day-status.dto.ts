import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class OptionalDayStatusesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  mon?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  tue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  wed?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  thu?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  fri?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  sat?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  sun?: number;
}
