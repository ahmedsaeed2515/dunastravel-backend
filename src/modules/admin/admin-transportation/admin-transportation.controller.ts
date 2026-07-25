import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminTransportationService } from './admin-transportation.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TransportationBookingStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('admin-transportation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/transportation')
export class AdminTransportationController {
  constructor(
    private readonly transportationService: AdminTransportationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all transportation bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.transportationService.findAll(
      Number(page),
      Number(limit),
      status,
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
    @Body('status') status: TransportationBookingStatus,
  ) {
    return this.transportationService.updateStatus(id, status);
  }

  @Patch(':id/assign-driver')
  @ApiOperation({ summary: 'Assign a driver to a transportation booking' })
  async assignDriver(
    @Param('id') id: string,
    @Body('driverName') driverName: string,
    @Body('vehicleType') vehicleType?: string,
  ) {
    return this.transportationService.assignDriver(id, driverName, vehicleType);
  }
}
