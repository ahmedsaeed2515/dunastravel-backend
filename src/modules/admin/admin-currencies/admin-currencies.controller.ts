import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminCurrenciesService } from './admin-currencies.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import { UpdateAdminCurrencyRatesDto } from './admin-currency.dto';

@ApiTags('Admin Currencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/currencies')
export class AdminCurrenciesController {
  constructor(private readonly service: AdminCurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all exchange rates and staleness metadata' })
  async findAll() {
    return this.service.findAll();
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Trigger on-demand rate synchronization from ECB/Frankfurter',
  })
  async syncRates(@CurrentUser() user: AuthenticatedUser) {
    return this.service.syncRates(user.id);
  }

  @Post('rates')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Ingest or update currency exchange rates manually',
  })
  async updateRates(
    @Body() body: UpdateAdminCurrencyRatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateRates(body.rates, user.id);
  }
}
