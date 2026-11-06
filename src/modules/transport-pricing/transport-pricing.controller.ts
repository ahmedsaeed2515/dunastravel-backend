import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { TransportPricingService } from './transport-pricing.service';
import {
  CreateTransportPricingDto,
  UpdateTransportPricingDto,
  TransportPricingResponse,
} from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Transport Pricing')
@Controller('transport-pricing')
export class TransportPricingController {
  constructor(
    private readonly pricingService: TransportPricingService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create transport pricing for a tour or booking' })
  @ApiOkResponse({ type: TransportPricingResponse, description: 'Transport pricing created successfully' })
  async create(@Body() dto: CreateTransportPricingDto, @CurrentUser() _user?: { id: string }) {
    return this.pricingService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transport pricing by tour or booking' })
  @ApiQuery({ name: 'tourId', required: false, description: 'Filter by tour ID' })
  @ApiQuery({ name: 'bookingId', required: false, description: 'Filter by booking ID' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiOkResponse({ type: [TransportPricingResponse], description: 'List of transport pricing' })
  async find(
    @Query('tourId') tourId?: string,
    @Query('bookingId') bookingId?: string,
    @Query('category') category?: string,
  ) {
    if (tourId) {
      return this.pricingService.findByTour(tourId);
    }
    if (bookingId) {
      return this.pricingService.findByBooking(bookingId);
    }
    if (category) {
      return this.pricingService.findByCategory(category);
    }
    return this.pricingService.findByTour(undefined);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transport pricing by ID' })
  @ApiOkResponse({ type: TransportPricingResponse, description: 'Transport pricing details' })
  async findOne(@Param('id') id: string) {
    const pricing = await this.pricingService.findById(id);
    if (!pricing) {
      throw new NotFoundException('Transport pricing not found');
    }
    return pricing;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update transport pricing price' })
  @ApiOkResponse({ type: TransportPricingResponse, description: 'Transport pricing updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransportPricingDto,
  ) {
    return this.pricingService.update(id, dto.priceUsd ?? 0);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle transport pricing active status' })
  @ApiOkResponse({ type: TransportPricingResponse, description: 'Transport pricing status toggled' })
  async toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.pricingService.toggleActive(id, isActive);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete transport pricing' })
  @ApiOkResponse({ description: 'Transport pricing deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.pricingService.delete(id);
  }
}
