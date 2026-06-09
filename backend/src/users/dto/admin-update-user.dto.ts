import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Пустая строка или null — снять привязку к карточке сотрудника. */
  @IsOptional()
  @IsString()
  linkedEmployeeId?: string | null;

  /** Для роли MASTER — привязка к карточке мастера CRM. */
  @IsOptional()
  @IsString()
  linkedCrmMasterId?: string | null;
}
