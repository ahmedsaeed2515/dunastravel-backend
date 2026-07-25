import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { Public } from '../../common/decorators/public.decorator';
import { ConvertCurrencyDto } from './dto/currency.dto';

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
    return this.currencyService.getRates();
  }

  @Get('convert')
  @Public()
  @ApiOperation({ summary: 'Convert an amount between two currencies' })
  async convert(@Query() query: ConvertCurrencyDto) {
    return this.currencyService.convert(query.amount, query.from, query.to);
  }
}
