import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HotelsService } from './hotels.service';
import { PublicHotelsQueryDto } from './dto/hotel-query.dto';
import { CreateHotelBookingDto } from './dto/hotel-booking.dto';

@ApiTags('hotels')
@Controller('hotels')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOperation({ summary: 'List published, active hotels' })
  @ApiQuery({ name: 'locale', required: false, type: String })
  @ApiQuery({ name: 'destinationSlug', required: false, type: String })
  async findAll(@Query() query: PublicHotelsQueryDto) {
    return this.hotelsService.findAllPublic(query.locale ?? 'en', query.destinationSlug, query.limit);
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a standalone hotel or room booking' })
  async createBooking(@Body() dto: CreateHotelBookingDto) {
    return this.hotelsService.createBookingPublic(dto);
  }

  @Get('bookings/:referenceCode')
  @ApiOperation({ summary: 'Get hotel booking confirmation by reference code' })
  async getBookingByReference(@Param('referenceCode') referenceCode: string) {
    return this.hotelsService.getBookingByReferencePublic(referenceCode);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published, active hotel by slug' })
  async findOne(@Param('slug') slug: string, @Query() query: PublicHotelsQueryDto) {
    return this.hotelsService.findOnePublic(slug, query.locale ?? 'en');
  }
}
