import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
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
import { CurrentUser, Public } from '../../common/decorators';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Transportation')
@Controller('transportation')
export class TransportationController {
  constructor(private readonly transportationService: TransportationService) {}

  @Get(['services', 'search'])
  @Public()
  @ApiOperation({ summary: 'Get available transportation services' })
  @ApiOkResponse({ description: 'List of active services' })
  async getServices() {
    return this.transportationService.findAllServices();
  }

  @Post('bookings')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Submit a new transportation booking request' })
  @ApiCreatedResponse({ description: 'Booking request created successfully' })
  async createBooking(
    @CurrentUser() user: { id: string } | undefined,
    @Body() dto: CreateTransportationBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transportationService.createBooking(
      user?.id ?? null,
      dto,
      idempotencyKey,
    );
  }

  @Get('bookings/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get transportation bookings for the authenticated user',
  })
  @ApiOkResponse({ description: 'List of user transportation bookings' })
  async getMyBookings(@CurrentUser() user: { id: string }) {
    return this.transportationService.findUserBookings(user.id);
  }
}
