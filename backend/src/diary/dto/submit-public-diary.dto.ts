import { Matches } from 'class-validator';

export class SubmitPublicDiaryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date: YYYY-MM-DD' })
  date!: string;
}
