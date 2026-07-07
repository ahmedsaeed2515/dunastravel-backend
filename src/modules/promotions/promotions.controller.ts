import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate a promotion code' })
  @ApiOkResponse({ description: 'Promotion details if valid' })
  async validatePromotion(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validatePromoCode(dto.promoCode);
  }
}
