import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtUserPayload } from './types/jwt-user';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.auth.refresh(dto.refreshToken);
    return {
      tokens: {
        accessToken: tokens.accessToken,
        expiresInSeconds: tokens.expiresInSeconds,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post('bootstrap')
  bootstrap(@Body() dto: RegisterDto) {
    return this.auth.registerBootstrap({
      email: dto.email,
      password: dto.password,
      name: dto.name,
    });
  }

  @Post('accounts')
  @Roles(UserRole.ADMIN)
  createAccount(@Body() dto: RegisterDto, @CurrentUser() _user: JwtUserPayload) {
    const role = dto.role ?? UserRole.VIEWER;
    return this.auth.registerAdmin({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role,
    });
  }
}
