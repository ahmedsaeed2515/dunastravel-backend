import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { TransportationService } from './transportation.service';
import {
  CreateTransportationServiceDto,
  UpdateTransportationServiceDto,
  QueryTransportationServiceDto,
  UpdateTransportationBookingStatusDto,
} from './dto/transportation-service.dto';

@ApiTags('Admin Transportation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/transportation')
export class AdminTransportationController {
  constructor(private readonly transportationService: TransportationService) {}

  @Get('services')
  @ApiOperation({ summary: 'List all transportation services for management' })
  @ApiOkResponse({ description: 'Paginated or full fleet list' })
  async getServices(@Query() query: QueryTransportationServiceDto) {
    return this.transportationService.findAllAdmin(query);
  }

  @Get('services/:id')
  @ApiOperation({ summary: 'Get a single transportation service by ID' })
  @ApiOkResponse({ description: 'Detailed transportation service' })
  async getServiceById(@Param('id') id: string) {
    return this.transportationService.findOneAdmin(id);
  }

  @Post('services')
  @ApiOperation({ summary: 'Create a new transportation vehicle/service' })
  @ApiCreatedResponse({ description: 'Vehicle created successfully' })
  async createService(@Body() dto: CreateTransportationServiceDto) {
    return this.transportationService.createAdmin(dto);
  }

  @Put('services/:id')
  @ApiOperation({ summary: 'Update an existing transportation service' })
  @ApiOkResponse({ description: 'Vehicle updated successfully' })
  async updateService(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationServiceDto,
  ) {
    return this.transportationService.updateAdmin(id, dto);
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Delete a transportation service' })
  @ApiOkResponse({ description: 'Vehicle deleted successfully' })
  async deleteService(@Param('id') id: string) {
    return this.transportationService.deleteAdmin(id);
  }

  @Post('services/:id/archive')
  @ApiOperation({ summary: 'Archive a transportation service (hide from active catalog)' })
  @ApiOkResponse({ description: 'Vehicle archived successfully' })
  async archiveService(@Param('id') id: string) {
    return this.transportationService.archiveAdmin(id);
  }

  @Post('services/:id/unarchive')
  @ApiOperation({ summary: 'Restore an archived transportation service to active' })
  @ApiOkResponse({ description: 'Vehicle restored to active draft' })
  async unarchiveService(@Param('id') id: string) {
    return this.transportationService.unarchiveAdmin(id);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List all transportation bookings with customer details' })
  @ApiOkResponse({ description: 'List of transportation bookings' })
  async getBookings(@Query('status') status?: string) {
    return this.transportationService.findAllBookingsAdmin(status);
  }

  @Patch('bookings/:id/status')
  @ApiOperation({ summary: 'Update status and driver assignment for a booking' })
  @ApiOkResponse({ description: 'Booking status updated successfully' })
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationBookingStatusDto,
  ) {
    return this.transportationService.updateBookingStatusAdmin(id, dto);
  }
}
