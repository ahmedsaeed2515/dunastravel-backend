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
} from './dto/customer-crm.dto';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';

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

  @Get('crm/metrics')
  @ApiOperation({ summary: 'Get live CRM analytics and dashboard metrics.' })
  @ApiOkResponse({ description: 'Aggregated CRM metrics object' })
  async getCrmDashboardMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getCrmDashboardMetrics(user.id);
  }

  @Get('crm/export/csv')
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
    @Param('id') id: string,
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
    @Param('id') id: string,
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
    @Param('id') id: string,
    @Body() dto: AddCustomerNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.addCustomerNote(id, dto, user.id);
  }

  @Post('crm/:id/documents')
  @ApiOperation({
    summary:
      'Attach a document (passport scan, visa, insurance, tickets) to a customer.',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddCustomerDocumentDto })
  @ApiOkResponse({ description: 'Customer document attached successfully' })
  async addCustomerDocument(
    @Param('id') id: string,
    @Body() dto: AddCustomerDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.addCustomerDocument(id, dto, user.id);
  }

  // ─── LEGACY USERS ENDPOINTS ────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all users with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of users' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const result = await this.userService.findAll({
      page,
      limit,
      search: query.search,
      role: query.role,
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

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a single user.' })
  @ApiOkResponse({ description: 'User record' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUser(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.userService.toSafeUser(user);
  }

  @Post()
  @UseGuards(SuperAdminEscalationGuard)
  @ApiOperation({ summary: 'Create a new user.' })
  @ApiCreatedResponse({ description: 'The created user' })
  async createUser(@Body() dto: CreateUserDto) {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

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
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    let passwordHash = undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updatedUser = await this.userService.update(id, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
    });

    if (dto.role) {
      void this.auditService.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: id,
        metadata: { newRole: dto.role },
        ipAddress: req.ip || 'unknown',
      });
    }

    return this.userService.toSafeUser(updatedUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user.' })
  @ApiOkResponse({ description: 'User deleted' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.userService.softDelete(id);
    void this.auditService.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip || 'unknown',
    });
    return { success: true };
  }
}
