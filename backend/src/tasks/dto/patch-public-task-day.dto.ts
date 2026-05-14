import { IsInt, Matches, Max, Min } from 'class-validator';

export class PatchPublicTaskDayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата должна быть в формате YYYY-MM-DD' })
  date!: string;

  @IsInt()
  @Min(0)
  @Max(2)
  score!: number;
}
