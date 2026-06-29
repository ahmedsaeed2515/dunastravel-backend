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
import { OptionalJwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

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
  ) {
    const userId = user?.id ?? null;
    return this.bookingsService.createBooking(dto, userId);
  }

  @Get(':referenceCode')
  @ApiOperation({ summary: 'Get booking summary by reference code' })
  @ApiOkResponse({ description: 'Booking summary' })
  @ApiBadRequestResponse({ description: 'Invalid reference format' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiParam({ name: 'referenceCode', example: 'BKG-A4X7Z2' })
  async findByReferenceCode(@Param('referenceCode') referenceCode: string) {
    if (!/^BKG-[A-Z0-9]{6}$/.test(referenceCode)) {
      throw new BadRequestException('Invalid booking reference format');
    }
    return this.bookingsService.findByReferenceCode(referenceCode);
  }
}
