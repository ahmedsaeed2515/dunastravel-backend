import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ConflictException,
  BadRequestException,
  Req,
  NotFoundException,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { SuperAdminEscalationGuard } from '../../common/guards/super-admin-escalation.guard';
import { UserRole } from '@prisma/client';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  ListCustomersQueryDto,
  UpdateCustomerCrmDto,
  BulkUpdateCustomersDto,
  AddCustomerNoteDto,
  AddCustomerDocumentDto,
  CreateCustomerCrmDto,
} from './dto/customer-crm.dto';
import {
  SuspendUserDto,
  AddUserMonitoringNoteDto,
  ListActivityStreamQueryDto,
} from './dto/user-monitoring.dto';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { assertStrongPassword } from '../../common/utils/password-policy.util';

@ApiTags('Admin Users & CRM')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  // ─── ENTERPRISE CRM ENDPOINTS (PHASE 5) ────────────────────────

  @Post('crm')
  @ApiOperation({ summary: 'Create a new customer profile in CRM.' })
  @ApiBody({ type: CreateCustomerCrmDto })
  @ApiCreatedResponse({ description: 'Created customer CRM profile' })
  async createCustomerCrm(
    @Body() dto: CreateCustomerCrmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.createCustomerCrm(dto, user.id);
  }

  @Get('crm/metrics')
  @ApiOperation({ summary: 'Get live CRM analytics and dashboard metrics.' })
  @ApiOkResponse({ description: 'Aggregated CRM metrics object' })
  async getCrmDashboardMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getCrmDashboardMetrics(user.id);
  }

  @Get('crm/export/csv')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export customers to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportCustomersCsv(
    @Query() query: ListCustomersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.exportCustomersCsv(query, user.id);
  }

  @Get('crm/list')
  @ApiOperation({
    summary:
      'List customers with advanced enterprise filtering and pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated list of customers with financial metrics',
  })
  async listCustomersCrm(
    @Query() query: ListCustomersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.findCustomersCrm(query, user.id);
  }

  @Patch('crm/bulk/update')
  @ApiOperation({
    summary: 'Bulk update customer segments, tags, VIP flags, or statuses.',
  })
  @ApiBody({ type: BulkUpdateCustomersDto })
  @ApiOkResponse({ description: 'Customers bulk updated successfully' })
  async bulkUpdateCustomers(
    @Body() dto: BulkUpdateCustomersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.bulkUpdateCustomers(dto, user.id);
  }

  @Get('crm/:id')
  @ApiOperation({ summary: 'Get fully populated customer CRM detail profile.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({
    description:
      'Rich customer profile including bookings, payments, notes, documents, and timeline.',
  })
  async getCustomerCrmDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.getCustomerCrmDetail(id, user.id);
  }

  @Patch('crm/:id')
  @ApiOperation({ summary: 'Update customer CRM profile fields.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateCustomerCrmDto })
  @ApiOkResponse({ description: 'Updated customer CRM profile' })
  async updateCustomerCrm(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerCrmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.updateCustomerCrm(id, dto, user.id);
  }

  @Post('crm/:id/notes')
  @ApiOperation({
    summary: 'Add an internal, sales, or operations note to a customer.',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddCustomerNoteDto })
  @ApiOkResponse({ description: 'Customer note added successfully' })
  async addCustomerNote(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCustomerNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.addCustomerNote(id, dto, user.id);
  }

  @Post('crm/:id/documents')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Attach a document (passport scan, visa, insurance, tickets) to a customer.',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddCustomerDocumentDto })
  @ApiOkResponse({ description: 'Customer document attached successfully' })
  async addCustomerDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddCustomerDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.addCustomerDocument(id, dto, user.id);
  }

  // ─── USER MONITORING & ACTIVITY HUB ─────────────────────────────

  @Get('monitoring/overview')
  @ApiOperation({ summary: 'Get global user monitoring metrics and analytics overview.' })
  @ApiOkResponse({ description: 'Aggregated user monitoring metrics' })
  async getMonitoringOverview() {
    return this.userService.getMonitoringOverview();
  }

  @Get('monitoring/live-stream')
  @ApiOperation({ summary: 'Get real-time / recent user activity stream across platform.' })
  @ApiOkResponse({ description: 'Paginated live activity items' })
  async getLiveActivityStream(@Query() query: ListActivityStreamQueryDto) {
    return this.userService.getLiveActivityStream(query);
  }

  // ─── USERS DIRECTORY & MANAGEMENT ENDPOINTS ───────────────────

  @Get()
  @ApiOperation({ summary: 'List all users with advanced monitoring filters and pagination.' })
  @ApiOkResponse({ description: 'Paginated list of users with summary counts' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const result = await this.userService.findAll({
      page,
      limit,
      search: query.search,
      role: query.role,
      status: query.status,
      isVerified: query.isVerified,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    return {
      data: result.users,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  @Get(':id/monitoring')
  @ApiOperation({ summary: 'Get comprehensive user monitoring profile, deep activity timeline, and relations.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Full user monitoring payload and timeline' })
  async getUserMonitoringDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.userService.getUserMonitoringDetail(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user account with reason and audit log.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: SuspendUserDto })
  @ApiOkResponse({ description: 'User account suspended' })
  async suspendUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assertCanManageTarget(actor, id, undefined, false, false);
    return this.userService.suspendUser(id, dto.reason, actor.id, actor.role, req.ip);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Reactivate a suspended user account.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'User account activated' })
  async activateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assertCanManageTarget(actor, id, undefined, false, false);
    return this.userService.activateUser(id, actor.id, actor.role, req.ip);
  }

  @Post(':id/revoke-sessions')
  @ApiOperation({ summary: 'Invalidate all active sessions for a user.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'User sessions invalidated' })
  async revokeSessions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assertCanManageTarget(actor, id, undefined, false, false);
    return this.userService.revokeSessionsAdmin(id, actor.id, req.ip);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add an admin monitoring / investigation note to a user.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddUserMonitoringNoteDto })
  @ApiOkResponse({ description: 'Monitoring note added successfully' })
  async addUserMonitoringNote(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddUserMonitoringNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.userService.addUserMonitoringNote(id, dto, actor.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a single user.' })
  @ApiOkResponse({ description: 'User record' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.userService.toSafeUser(user);
  }

  @Post()
  @UseGuards(SuperAdminEscalationGuard)
  @ApiOperation({ summary: 'Create a new user.' })
  @ApiCreatedResponse({ description: 'The created user' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      this.isPrivilegedRole(dto.role)
    ) {
      throw new ForbiddenException(
        'Only a SUPER_ADMIN can create privileged accounts',
      );
    }

    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    assertStrongPassword(dto.password);

    const existing = await this.userService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.userService.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
      isVerified: true,
    });

    return this.userService.toSafeUser(user);
  }

  @Patch(':id')
  @UseGuards(SuperAdminEscalationGuard)
  @ApiOperation({ summary: 'Update an existing user.' })
  @ApiOkResponse({ description: 'The updated user' })
  async updateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const target = await this.assertCanManageTarget(
      user,
      id,
      dto.role,
      Boolean(dto.password),
      false,
    );
    if (target.id === user.id && dto.role && dto.role !== target.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    if (
      dto.confirmPassword &&
      dto.password &&
      dto.password !== dto.confirmPassword
    ) {
      throw new BadRequestException('Passwords do not match');
    }

    let passwordHash = undefined;
    const cleanPassword = dto.password?.trim();
    if (cleanPassword && cleanPassword.length > 0) {
      assertStrongPassword(cleanPassword);
      passwordHash = await bcrypt.hash(cleanPassword, 12);
    }

    const updatedUser = await this.userService.update(
      id,
      {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        passwordHash,
      },
      user.role,
    );

    if (dto.role) {
      await this.auditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: id,
        metadata: { newRole: dto.role },
        ipAddress: req.ip || 'unknown',
      });
    }
    if (dto.password) {
      await this.auditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
        entityType: 'User',
        entityId: id,
        ipAddress: req.ip || 'unknown',
      });
    }

    return this.userService.toSafeUser(updatedUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user.' })
  @ApiOkResponse({ description: 'User deleted' })
  async deleteUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assertCanManageTarget(user, id, undefined, false, true);
    await this.userService.softDelete(id, user.role);
    await this.auditService.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip || 'unknown',
    });
    return { success: true };
  }

  private isPrivilegedRole(role?: UserRole): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private async assertCanManageTarget(
    actor: AuthenticatedUser,
    targetId: string,
    requestedRole?: UserRole,
    changesPassword = false,
    deletesTarget = false,
  ) {
    const target = await this.userService.findById(targetId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      (this.isPrivilegedRole(target.role) ||
        this.isPrivilegedRole(requestedRole))
    ) {
      throw new ForbiddenException(
        'Only a SUPER_ADMIN can manage privileged accounts',
      );
    }

    if (actor.id === target.id && (changesPassword || deletesTarget)) {
      throw new ForbiddenException(
        changesPassword
          ? 'Use the authenticated change-password flow for your own account'
          : 'You cannot delete your own account',
      );
    }

    const removesSuperAdmin =
      target.role === UserRole.SUPER_ADMIN &&
      (deletesTarget ||
        (requestedRole !== undefined &&
          requestedRole !== UserRole.SUPER_ADMIN));
    if (
      removesSuperAdmin &&
      (await this.userService.countActiveSuperAdmins()) <= 1
    ) {
      throw new ForbiddenException(
        'The last active SUPER_ADMIN cannot be removed or demoted',
      );
    }

    return target;
  }
}
