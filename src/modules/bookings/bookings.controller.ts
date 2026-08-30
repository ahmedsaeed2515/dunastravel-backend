import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  BadRequestException,
  UnauthorizedException,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CalculatePriceDto } from './dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { ParseBookingRefPipe } from '../../common/pipes/parse-booking-ref.pipe';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create an authenticated tour booking' })
  @ApiCreatedResponse({ description: 'Booking created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid tour' })
  @ApiUnprocessableEntityResponse({ description: 'Tour not available' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication is required to create a booking',
      );
    }
    return this.bookingsService.createBooking(dto, user.id, idempotencyKey);
  }

  @Post('calculate')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
    @Query() query: PaginationQueryDto,
  ) {
    return this.bookingsService.findUserBookings(
      user.id,
      query.page,
      query.limit,
    );
  }

  @Get(':referenceCode')
  @Public()
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
  @Public()
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
    @Body() dto: CancelBookingDto,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const userId = user?.id ?? undefined;
    return this.bookingsService.cancelBooking(
      referenceCode,
      userId,
      dto.reason,
      guestToken,
    );
  }
}
