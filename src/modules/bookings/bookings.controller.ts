import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Query,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnprocessableEntityResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CalculatePriceDto } from './dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { ParseBookingRefPipe } from '../../common/pipes/parse-booking-ref.pipe';

interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create a tour booking' })
  @ApiCreatedResponse({ description: 'Booking created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid tour' })
  @ApiUnprocessableEntityResponse({ description: 'Tour not available' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = user?.id ?? undefined;
    return this.bookingsService.createBooking(dto, userId, idempotencyKey);
  }

  @Post('calculate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Calculate booking price' })
  @ApiOkResponse({ description: 'Calculated price' })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.bookingsService.calculatePrice(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all bookings for current user' })
  @ApiOkResponse({ description: 'List of user bookings' })
  async findUserBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.bookingsService.findUserBookings(
      user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':referenceCode')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Get booking summary by reference code' })
  @ApiOkResponse({ description: 'Booking summary' })
  @ApiBadRequestResponse({ description: 'Invalid reference format' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiParam({ name: 'referenceCode', example: 'BKG-A4X7Z2' })
  async findByReferenceCode(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const userId = user?.id ?? undefined;
    return this.bookingsService.findByReferenceCode(
      referenceCode,
      userId,
      guestToken,
    );
  }

  @Post(':referenceCode/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel a booking (authenticated owner or guest token)',
  })
  @ApiOkResponse({ description: 'Booking cancelled' })
  @ApiParam({ name: 'referenceCode', example: 'BKG-A4X7Z2' })
  async cancelBooking(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @Body('reason') reason?: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const userId = user?.id ?? undefined;
    return this.bookingsService.cancelBooking(
      referenceCode,
      userId,
      reason,
      guestToken,
    );
  }
}
