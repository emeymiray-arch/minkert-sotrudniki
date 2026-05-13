import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtUserPayload) {
    const me = await this.users.requireById(user.sub);
    return {
      id: me.id,
      email: me.email,
      name: me.name,
      role: me.role,
    };
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtUserPayload, @Body() dto: UpdateMyProfileDto) {
    return this.users.updateMyProfile(user.sub, dto);
  }
}
