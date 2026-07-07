import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ConvertCurrencyDto } from './dto/currency.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin - Currency Engine')
@Controller('admin/currency')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get current global exchange rates from Redis Cache',
  })
  async getRates() {
    const rates = await this.currencyService.getRates();
    return {
      base: 'USD',
      rates,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('convert')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Convert an amount between two currencies' })
  async convert(@Query() query: ConvertCurrencyDto) {
    const result = await this.currencyService.convert(
      query.amount,
      query.from,
      query.to,
    );
    return {
      originalAmount: query.amount,
      from: query.from.toUpperCase(),
      to: query.to.toUpperCase(),
      convertedAmount: result,
    };
  }
}
