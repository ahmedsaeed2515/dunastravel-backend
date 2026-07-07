import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Currency Engine')
@Controller('currency')
export class PublicCurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @Public()
  @ApiOperation({
    summary: 'Get current global exchange rates',
  })
  @ApiOkResponse({ description: 'Current exchange rates' })
  async getRates() {
    const rates = await this.currencyService.getRates();
    return {
      base: 'USD',
      rates,
      timestamp: new Date().toISOString(),
    };
  }
}
