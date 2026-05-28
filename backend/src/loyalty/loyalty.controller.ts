import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('clients')
  list(@Query('q') q?: string) {
    return this.loyalty.listClients(q);
  }

  @Post('clients')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() body: { name: string; phone: string }) {
    return this.loyalty.createClient(body);
  }

  @Patch('clients/:id/stamps/:slot')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  patchStamp(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @Body() body: { masterName: string },
  ) {
    return this.loyalty.upsertStamp(id, Number(slot), body.masterName ?? '');
  }
}
