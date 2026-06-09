import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
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
      linkedEmployeeId: me.linkedEmployeeId ?? null,
    };
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtUserPayload, @Body() dto: UpdateMyProfileDto) {
    return this.users.updateMyProfile(user.sub, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.users.listUsers();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  adminUpdate(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdateUser(id, dto);
  }
}
