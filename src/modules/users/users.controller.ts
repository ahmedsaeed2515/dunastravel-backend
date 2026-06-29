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
  Req,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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

@ApiTags('Admin Users & CRM')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  // ─── ENTERPRISE CRM ENDPOINTS (PHASE 5) ────────────────────────

  @Get('crm/metrics')
  @ApiOperation({ summary: 'Get live CRM analytics and dashboard metrics.' })
  @ApiOkResponse({ description: 'Aggregated CRM metrics object' })
  async getCrmDashboardMetrics(@Req() req: any) {
    return this.userService.getCrmDashboardMetrics(req.user.id);
  }

  @Get('crm/export/csv')
  @ApiOperation({ summary: 'Export customers to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportCustomersCsv(@Query() query: ListCustomersQueryDto, @Req() req: any) {
    return this.userService.exportCustomersCsv(query, req.user.id);
  }

  @Get('crm/list')
  @ApiOperation({ summary: 'List customers with advanced enterprise filtering and pagination.' })
  @ApiOkResponse({ description: 'Paginated list of customers with financial metrics' })
  async listCustomersCrm(@Query() query: ListCustomersQueryDto, @Req() req: any) {
    return this.userService.findCustomersCrm(query, req.user.id);
  }

  @Patch('crm/bulk/update')
  @ApiOperation({ summary: 'Bulk update customer segments, tags, VIP flags, or statuses.' })
  @ApiBody({ type: BulkUpdateCustomersDto })
  @ApiOkResponse({ description: 'Customers bulk updated successfully' })
  async bulkUpdateCustomers(@Body() dto: BulkUpdateCustomersDto, @Req() req: any) {
    return this.userService.bulkUpdateCustomers(dto, req.user.id);
  }

  @Get('crm/:id')
  @ApiOperation({ summary: 'Get fully populated customer CRM detail profile.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Rich customer profile including bookings, payments, notes, documents, and timeline.' })
  async getCustomerCrmDetail(@Param('id') id: string, @Req() req: any) {
    return this.userService.getCustomerCrmDetail(id, req.user.id);
  }

  @Patch('crm/:id')
  @ApiOperation({ summary: 'Update customer CRM profile fields.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateCustomerCrmDto })
  @ApiOkResponse({ description: 'Updated customer CRM profile' })
  async updateCustomerCrm(@Param('id') id: string, @Body() dto: UpdateCustomerCrmDto, @Req() req: any) {
    return this.userService.updateCustomerCrm(id, dto, req.user.id);
  }

  @Post('crm/:id/notes')
  @ApiOperation({ summary: 'Add an internal, sales, or operations note to a customer.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddCustomerNoteDto })
  @ApiOkResponse({ description: 'Customer note added successfully' })
  async addCustomerNote(@Param('id') id: string, @Body() dto: AddCustomerNoteDto, @Req() req: any) {
    return this.userService.addCustomerNote(id, dto, req.user.id);
  }

  @Post('crm/:id/documents')
  @ApiOperation({ summary: 'Attach a document (passport scan, visa, insurance, tickets) to a customer.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: AddCustomerDocumentDto })
  @ApiOkResponse({ description: 'Customer document attached successfully' })
  async addCustomerDocument(@Param('id') id: string, @Body() dto: AddCustomerDocumentDto, @Req() req: any) {
    return this.userService.addCustomerDocument(id, dto, req.user.id);
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
    if (!user) throw new ConflictException('User not found');
    return this.userService.toSafeUser(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user.' })
  @ApiCreatedResponse({ description: 'The created user' })
  async createUser(@Body() dto: CreateUserDto) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.userService.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
    });

    return this.userService.toSafeUser(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing user.' })
  @ApiOkResponse({ description: 'The updated user' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    let passwordHash = undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const user = await this.userService.update(id, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      passwordHash,
    });

    return this.userService.toSafeUser(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user.' })
  @ApiOkResponse({ description: 'User deleted' })
  async deleteUser(@Param('id') id: string) {
    await this.userService.softDelete(id);
    return { success: true };
  }
}
