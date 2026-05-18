import { Matches } from 'class-validator';

export class RolloverWeekDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'weekAnchor: YYYY-MM-DD' })
  weekAnchor!: string;
}
