import { IsOptional, IsString } from 'class-validator';

export class AdminUpdateUserDto {
  /** Привязка к карточке сотрудника: VIEWER сможет менять дни в задачах только этой карточки. Пустая строка или null — снять привязку. */
  @IsOptional()
  @IsString()
  linkedEmployeeId?: string | null;
}
