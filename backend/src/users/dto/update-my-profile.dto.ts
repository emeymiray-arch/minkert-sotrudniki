import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMyProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(160)
  email!: string;
}
