/* eslint-disable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  UseGuards,
  BadRequestException,
  Query,
  Headers,
} from '@nestjs/common';
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
import { CreateBookingDto } from './dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { ParseBookingRefPipe } from '../../common/pipes/parse-booking-ref.pipe';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create a tour booking' })
  @ApiCreatedResponse({ description: 'Booking created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid tour' })
  @ApiUnprocessableEntityResponse({ description: 'Tour not available' })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: any | null,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = user?.id ?? null;
    return this.bookingsService.createBooking(dto, userId, idempotencyKey);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all bookings for current user' })
  @ApiOkResponse({ description: 'List of user bookings' })
  async findUserBookings(@CurrentUser() user: any) {
    return this.bookingsService.findUserBookings(user.id);
  }

  @Get(':referenceCode')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get booking summary by reference code' })
  @ApiOkResponse({ description: 'Booking summary' })
  @ApiBadRequestResponse({ description: 'Invalid reference format' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiParam({ name: 'referenceCode', example: 'BKG-A4X7Z2' })
  async findByReferenceCode(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: any | null,
    @Query('email') email?: string,
  ) {
    const userId = user?.id ?? null;
    return this.bookingsService.findByReferenceCode(
      referenceCode,
      email,
      userId,
    );
  }
}
