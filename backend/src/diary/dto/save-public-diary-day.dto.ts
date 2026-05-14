import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsString, MaxLength, ValidateNested } from 'class-validator';
import { DiaryLineState } from '@prisma/client';

export class SavePublicDiaryLineDto {
  @IsString()
  @MaxLength(400)
  label!: string;

  @IsEnum(DiaryLineState)
  state!: DiaryLineState;
}

export class SavePublicDiaryDayDto {
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => SavePublicDiaryLineDto)
  lines!: SavePublicDiaryLineDto[];
}
