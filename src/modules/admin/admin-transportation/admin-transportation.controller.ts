import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminTransportationService } from './admin-transportation.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  AdminTransportationQueryDto,
  AssignTransportationDriverDto,
  CreateTransportationServiceDto,
  UpdateTransportationServiceDto,
  UpdateTransportationStatusDto,
} from './dto/admin-transportation.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';

@ApiTags('admin-transportation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/transportation')
export class AdminTransportationController {
  constructor(
    private readonly transportationService: AdminTransportationService,
  ) {}

  @Get('services')
  @ApiOperation({ summary: 'List transportation services for administration' })
  async findAllServices() {
    return this.transportationService.findAllServices();
  }

  @Post('services')
  @ApiOperation({ summary: 'Create a transportation service' })
  async createService(
    @Body() dto: CreateTransportationServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.transportationService.createService(dto, actor);
  }

  @Put('services/:id')
  @ApiOperation({ summary: 'Update a transportation service' })
  async updateService(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.transportationService.updateService(id, dto, actor);
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Deactivate a transportation service' })
  async deactivateService(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.transportationService.deactivateService(id, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List all transportation bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(@Query() query: AdminTransportationQueryDto) {
    return this.transportationService.findAll(
      query.page,
      query.limit,
      query.status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transportation booking' })
  async findOne(@Param('id') id: string) {
    return this.transportationService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update transportation booking status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.transportationService.updateStatus(id, dto.status, actor);
  }

  @Patch(':id/assign-driver')
  @ApiOperation({ summary: 'Assign a driver to a transportation booking' })
  async assignDriver(
    @Param('id') id: string,
    @Body() dto: AssignTransportationDriverDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.transportationService.assignDriver(
      id,
      dto.driverName,
      dto.vehicleType,
      actor,
    );
  }
}
