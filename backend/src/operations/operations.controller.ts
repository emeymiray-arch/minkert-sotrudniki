import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  OpsAttendanceMark,
  OpsTaskCheckType,
  OpsTaskStatus,
  OpsTimeBlock,
  OpsViolationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user';
import { OperationsService } from './operations.service';

@Controller('operations')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Get('dashboard')
  dashboard(@Query('date') date?: string) {
    return this.ops.dashboard(date);
  }

  @Get('blocks')
  blocks() {
    return this.ops.listBlocks();
  }

  @Patch('blocks/:block')
  updateBlock(
    @Param('block') block: OpsTimeBlock,
    @Body() body: { title?: string; timeStart?: string; timeEnd?: string; enabled?: boolean; sortOrder?: number },
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.ops.updateBlock(block, body, user);
  }

  @Get('board')
  board(@Query('block') block: OpsTimeBlock, @Query('date') date?: string) {
    return this.ops.getBoard(block, date);
  }

  @Get('tasks')
  listTasks(@Query('block') block: OpsTimeBlock, @Query('date') date?: string) {
    return this.ops.listTasks(block, date);
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: { block: OpsTimeBlock; forDate?: string; title: string },
  ) {
    return this.ops.createCategory(user, body);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; pinned: boolean; sortOrder: number }>,
  ) {
    return this.ops.updateCategory(user, id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.ops.deleteCategory(user, id);
  }

  @Post('categories/reorder')
  reorderCategories(@CurrentUser() user: JwtUserPayload, @Body() body: { orderedIds: string[] }) {
    return this.ops.reorderCategories(user, body.orderedIds ?? []);
  }

  @Post('tasks')
  createTask(
    @CurrentUser() user: JwtUserPayload,
    @Body()
    body: {
      block: OpsTimeBlock;
      title: string;
      description?: string;
      forDate?: string;
      dueAt?: string | null;
      assigneeId?: string | null;
      pinned?: boolean;
      recurring?: boolean;
      templateKey?: string | null;
      categoryId?: string | null;
      categoryLabel?: string;
      checkType?: OpsTaskCheckType;
    },
  ) {
    return this.ops.createTask(user, body);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      status: OpsTaskStatus;
      dueAt: string | null;
      assigneeId: string | null;
      pinned: boolean;
      block: OpsTimeBlock;
      forDate: string;
      categoryId: string | null;
      categoryLabel: string;
      checkType: OpsTaskCheckType;
    }>,
  ) {
    return this.ops.updateTask(user, id, body);
  }

  @Get('tasks/:id/check-sheet')
  checkSheet(@Param('id') id: string, @Query('date') date?: string) {
    return this.ops.getCheckSheet(id, date);
  }

  @Put('tasks/:id/check-sheet')
  saveCheckSheet(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @Body()
    body: {
      rows: Array<{
        employeeId: string;
        attendanceMark?: string | null;
        checklistOpened?: boolean | null;
        checklistDone?: boolean | null;
        checklistIgnored?: boolean | null;
        reportSubmitted?: boolean | null;
        reportError?: boolean | null;
        reportNeedsFix?: boolean | null;
        comment?: string;
        extraNote?: string;
        flagViolation?: boolean;
      }>;
    },
  ) {
    const rows = (body.rows ?? []).map((r) => ({
      ...r,
      attendanceMark: r.attendanceMark as OpsAttendanceMark | null | undefined,
    }));
    return this.ops.saveCheckSheet(user, id, date, rows);
  }

  @Get('check-journal')
  checkJournal(
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('checkType') checkType?: OpsTaskCheckType,
  ) {
    return this.ops.getCheckJournal({ employeeId, from, to, checkType });
  }

  @Delete('tasks/:id')
  deleteTask(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.ops.deleteTask(user, id);
  }

  @Post('tasks/reorder')
  reorder(@CurrentUser() user: JwtUserPayload, @Body() body: { orderedIds: string[] }) {
    return this.ops.reorderTasks(user, body.orderedIds ?? []);
  }

  @Post('tasks/:id/duplicate')
  duplicate(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.ops.duplicateTask(user, id);
  }

  @Post('tasks/:id/move')
  move(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: { block: OpsTimeBlock; forDate?: string },
  ) {
    return this.ops.moveTask(user, id, body.block, body.forDate);
  }

  @Get('tasks/:id/history')
  history(@Param('id') id: string) {
    return this.ops.taskHistory(id);
  }

  @Post('tasks/:id/comments')
  comment(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.ops.addComment(user, id, body.body ?? '');
  }

  @Post('tasks/:id/notes')
  note(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.ops.addNote(user, id, body.body ?? '');
  }

  @Get('staff')
  staff() {
    return this.ops.listStaff();
  }

  @Get('staff/:employeeId')
  staffOne(@Param('employeeId') employeeId: string) {
    return this.ops.getStaff(employeeId);
  }

  @Patch('staff/:employeeId/profile')
  staffProfile(
    @CurrentUser() user: JwtUserPayload,
    @Param('employeeId') employeeId: string,
    @Body()
    body: Partial<{
      schedule: string;
      disciplineLevel: number;
      warningsCount: number;
      preferences: string;
      workStyle: string;
      traits: string;
      managerNotes: string;
      clientAttitude: string;
      qualityNotes: string;
    }>,
  ) {
    return this.ops.upsertStaffProfile(employeeId, body, user);
  }

  @Get('violations')
  violations(@Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listViolations(from, to);
  }

  @Post('violations')
  createViolation(
    @CurrentUser() user: JwtUserPayload,
    @Body()
    body: {
      employeeId: string;
      type?: OpsViolationType;
      description?: string;
      occurredAt?: string;
      warned?: boolean;
    },
  ) {
    return this.ops.createViolation(user, body);
  }

  @Delete('violations/:id')
  deleteViolation(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.ops.deleteViolation(user, id);
  }

  @Get('content-reviews')
  contentReviews(@Query('date') date?: string) {
    return this.ops.listContentReviews(date);
  }

  @Post('content-reviews')
  contentReview(
    @CurrentUser() user: JwtUserPayload,
    @Body()
    body: {
      id?: string;
      employeeId: string;
      roleType?: 'STORY' | 'REEL';
      title?: string;
      reviewDate?: string;
      reach?: number;
      engagement?: number;
      views?: number;
      visualScore?: number;
      brandMatch?: boolean;
      qualityNote?: string;
      checked?: boolean;
    },
  ) {
    return this.ops.upsertContentReview(user, body);
  }

  @Get('reports')
  reports(@Query('date') date?: string) {
    return this.ops.listReports(date);
  }

  @Post('reports/ingest')
  ingestReport(
    @Body()
    body: {
      formKey: string;
      employeeId?: string;
      reportDate?: string;
      payload?: unknown;
      status?: 'SUBMITTED' | 'MISSED' | 'ERROR';
      errorNote?: string;
    },
  ) {
    return this.ops.ingestReport({
      ...body,
      payload: body.payload as Prisma.InputJsonValue | undefined,
    });
  }

  @Get('settings')
  settings() {
    return this.ops.getSettings();
  }

  @Patch('settings')
  patchSettings(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: { googleFormMappings?: unknown; formsWebhookNote?: string },
  ) {
    return this.ops.updateSettings(user, {
      formsWebhookNote: body.formsWebhookNote,
      googleFormMappings: body.googleFormMappings as Prisma.InputJsonValue | undefined,
    });
  }

  @Get('analytics')
  analytics(@Query('date') date?: string) {
    return this.ops.analyticsSummary(date);
  }

  @Get('activity')
  activity(@Query('limit') limit?: string) {
    return this.ops.activityFeed(limit ? Number(limit) : 30);
  }
}

/** Просмотр дашборда для начальников (только чтение). */
@Controller('operations/view')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
export class OperationsViewController {
  constructor(private readonly ops: OperationsService) {}

  @Get('dashboard')
  dashboard(@Query('date') date?: string) {
    return this.ops.dashboard(date);
  }

  @Get('analytics')
  analytics(@Query('date') date?: string) {
    return this.ops.analyticsSummary(date);
  }
}
