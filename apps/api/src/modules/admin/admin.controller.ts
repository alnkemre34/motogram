// Spec 5.4 - Admin Paneli REST API
// Tum endpoint'ler JwtAuthGuard + RolesGuard. ADMIN ve MODERATOR okur,
// sadece ADMIN mutasyon yapar (user role atama + ban).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  AdminAuditLogsListResponseSchema,
  AdminDashboardSnapshotSchema,
  AdminReportDtoSchema,
  AdminReportsListResponseSchema,
  AdminUnbanUserResponseSchema,
  AdminUserDtoSchema,
  AdminUsersListResponseSchema,
  BanUserSchema,
  ListAdminUsersQuerySchema,
  ListAuditLogsQuerySchema,
  ListReportsQuerySchema,
  ReviewReportSchema,
  SetUserRoleSchema,
  type BanUserDto,
  type ReviewReportDto,
  type SetUserRoleDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ---- Dashboard ----
  @Get('dashboard/snapshot')
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AdminDashboardSnapshotSchema)
  async dashboard() {
    return this.admin.dashboardSnapshot();
  }

  // ---- Reports ----
  @Get('reports')
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AdminReportsListResponseSchema)
  async listReports(@Query() rawQuery: unknown) {
    const query = ListReportsQuerySchema.parse(rawQuery);
    return this.admin.listReports(query);
  }

  @Patch('reports/:id')
  @Roles('ADMIN', 'MODERATOR')
  @UsePipes(new ZodValidationPipe())
  @ZodResponse(AdminReportDtoSchema)
  async reviewReport(
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    ReviewReportSchema.parse(dto);
    return this.admin.reviewReport(id, actor.userId, dto);
  }

  // ---- Users ----
  @Get('users')
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AdminUsersListResponseSchema)
  async listUsers(@Query() rawQuery: unknown) {
    const query = ListAdminUsersQuerySchema.parse(rawQuery);
    return this.admin.listUsers(query);
  }

  @Post('users/:id/ban')
  @Roles('ADMIN', 'MODERATOR')
  @UsePipes(new ZodValidationPipe())
  @ZodResponse(AdminUserDtoSchema)
  async banUser(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    BanUserSchema.parse(dto);
    return this.admin.banUser(id, actor.userId, dto);
  }

  @Delete('users/:id/ban')
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AdminUnbanUserResponseSchema)
  async unbanUser(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.admin.unbanUser(id, actor.userId);
    return { id, unbanned: true };
  }

  @Patch('users/:id/role')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe())
  @ZodResponse(AdminUserDtoSchema)
  async setRole(
    @Param('id') id: string,
    @Body() dto: SetUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    SetUserRoleSchema.parse(dto);
    return this.admin.setUserRole(id, actor.userId, dto);
  }

  // ---- Audit Log ----
  @Get('audit-logs')
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AdminAuditLogsListResponseSchema)
  async listAuditLogs(@Query() rawQuery: unknown) {
    const query = ListAuditLogsQuerySchema.parse(rawQuery);
    return this.admin.listAuditLogs(query);
  }
}
