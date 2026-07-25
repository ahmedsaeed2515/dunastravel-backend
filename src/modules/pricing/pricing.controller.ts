import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate dynamic pricing for a tour booking' })
  @ApiOkResponse({
    description: 'Returns base subtotal, discounts, and final total',
  })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.pricingService.calculatePrice(dto);
  }
}
