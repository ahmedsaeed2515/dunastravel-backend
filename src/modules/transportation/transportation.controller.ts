import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TransportationService } from './transportation.service';
import { CreateTransportationBookingDto } from './dto/create-transportation-booking.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

@ApiTags('Transportation')
@Controller('transportation')
export class TransportationController {
  constructor(private readonly transportationService: TransportationService) {}

  @Get(['services', 'search'])
  @ApiOperation({ summary: 'Get available transportation services' })
  @ApiOkResponse({ description: 'List of active services' })
  async getServices() {
    return this.transportationService.findAllServices();
  }

  @Post(['bookings', 'book'])
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Submit a new transportation booking request' })
  @ApiCreatedResponse({ description: 'Booking request created successfully' })
  async createBooking(
    @CurrentUser() user: any,
    @Body() dto: CreateTransportationBookingDto,
  ) {
    return this.transportationService.createBooking(user?.id || null, dto);
  }

  @Get('bookings/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get transportation bookings for the authenticated user',
  })
  @ApiOkResponse({ description: 'List of user transportation bookings' })
  async getMyBookings(@CurrentUser() user: any) {
    return this.transportationService.findUserBookings(user.id);
  }
}
