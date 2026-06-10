import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CrmClientStatus, CrmVisitStatus, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { CrmService } from './crm.service';

@Controller('crm')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MASTER, UserRole.LOYALTY)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('workspace')
  workspace() {
    return this.crm.getWorkspaceConfig();
  }

  @Patch('workspace')
  @Roles(UserRole.ADMIN)
  patchWorkspace(
    @Body()
    body: {
      salons?: Array<{ id: string; name: string; address: string }>;
    },
  ) {
    return this.crm.updateWorkspaceConfig(body);
  }

  @Get('masters')
  listMasters() {
    return this.crm.listMasters(true);
  }

  @Post('masters')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createMaster(@Body() body: { name: string; phone?: string; specialty?: string; salonId?: string }) {
    return this.crm.createMaster(body);
  }

  @Patch('masters/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  patchMaster(
    @Param('id') id: string,
    @Body()
    body: Partial<{ name: string; phone: string; specialty: string; salonId: string; active: boolean; sortOrder: number }>,
  ) {
    return this.crm.updateMaster(id, body);
  }

  @Delete('masters/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  removeMaster(@Param('id') id: string) {
    return this.crm.deleteMaster(id);
  }

  @Get('schedule')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  schedule(@Query('date') date: string, @Query('salonId') salonId?: string) {
    if (!date?.trim()) throw new BadRequestException('date обязателен (YYYY-MM-DD)');
    return this.crm.getSchedule(date.trim(), salonId);
  }

  @Get('masters/slot')
  checkSlot(
    @Query('masterId') masterId: string,
    @Query('startsAt') startsAt: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    if (!masterId?.trim() || !startsAt?.trim()) {
      throw new BadRequestException('masterId и startsAt обязательны');
    }
    const dur = durationMinutes ? Number(durationMinutes) : undefined;
    return this.crm.checkMasterSlot(masterId.trim(), startsAt, dur);
  }

  @Get('clients')
  listClients(
    @Query('q') q?: string,
    @Query('phone') phone?: string,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    return this.crm.listClients(q, phone, user);
  }

  @Get('clients/:id')
  getClient(@Param('id') id: string) {
    return this.crm.getClient(id);
  }

  @Post('clients')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createClient(
    @Body() body: { fullName: string; phone?: string; birthDate?: string; note?: string },
  ) {
    return this.crm.createClient(body);
  }

  @Patch('clients/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  patchClient(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      fullName: string;
      phone: string;
      birthDate: string | null;
      note: string;
      status: CrmClientStatus;
      warned: boolean;
      discountPercent: number;
    }>,
  ) {
    return this.crm.updateClient(id, body);
  }

  @Delete('clients/:id')
  @Roles(UserRole.ADMIN)
  deleteClient(@Param('id') id: string) {
    return this.crm.deleteClient(id);
  }

  @Get('clients/:id/interval-status')
  intervalStatus(
    @Param('id') id: string,
    @Query('plannedAt') plannedAt?: string,
  ) {
    return this.crm.clientIntervalStatus(id, plannedAt);
  }

  @Post('clients/:id/procedures')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  addProcedure(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body()
    body: {
      masterId?: string | null;
      procedureDate: string;
      service: string;
      cost: number;
      basePrice?: number;
      discountPercent?: number;
      extraService?: string;
      extraCost?: number;
      intervalDays: number;
      masterComment?: string;
      photosBeforeAfter?: unknown;
      nextVisitDate?: string;
      nextVisitComment?: string;
      nextVisitAdvice?: string;
    },
  ) {
    return this.crm.addProcedure(user, id, body);
  }

  @Post('appointments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createAppointment(
    @Body()
    body: {
      clientId?: string;
      newClient?: { fullName: string; phone?: string };
      masterId?: string | null;
      salonId?: string;
      service: string;
      startsAt: string;
      durationMinutes?: number;
      sequenceNumber?: number;
      comment?: string;
      forceInterval?: boolean;
    },
  ) {
    return this.crm.createAppointment(body);
  }

  @Get('appointments')
  listAppointments(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('masterId') masterId?: string,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    return this.crm.listAppointments(from, to, masterId, user);
  }

  @Patch('appointments/:id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setAppointmentStatus(
    @Param('id') id: string,
    @Body() body: { visitStatus: CrmVisitStatus },
  ) {
    if (!Object.values(CrmVisitStatus).includes(body.visitStatus)) {
      throw new BadRequestException('Некорректный статус посещения');
    }
    return this.crm.updateAppointmentStatus(id, body.visitStatus);
  }

  @Delete('appointments/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  removeAppointment(@Param('id') id: string) {
    return this.crm.deleteAppointment(id);
  }

  @Get('intervals')
  intervals(
    @Query('q') q?: string,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    return this.crm.listIntervals(q, user);
  }

  @Get('repeat-needed')
  repeatNeeded(
    @Query('q') q?: string,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    return this.crm.dueForRepeat(q, user);
  }

  @Get('lost')
  lost(@Query('days') days?: string) {
    return this.crm.lostClients(days ? Number(days) : 90);
  }

  @Get('analytics')
  analytics() {
    return this.crm.analytics();
  }
}
