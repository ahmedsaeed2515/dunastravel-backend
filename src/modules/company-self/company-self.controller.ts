import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators';
import { CompanySelfService } from './company-self.service';

@ApiTags('Company Self-Service')
@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY', 'AGENT')
@ApiBearerAuth()
export class CompanySelfController {
  constructor(private readonly companySelfService: CompanySelfService) {}

  @Get('bookings')
  @ApiOperation({ summary: 'Get all bookings for my company' })
  @ApiOkResponse({ description: 'Company bookings' })
  getBookings(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.companySelfService.getCompanyBookings(user.companyId, page, limit);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Get commission records for my company' })
  @ApiOkResponse({ description: 'Company commissions' })
  getCommissions(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.companySelfService.getCompanyCommissions(user.companyId, page, limit);
  }

  @Get('wallet')
  @ApiOperation({ summary: 'Get wallet balance for my company' })
  @ApiOkResponse({ description: 'Company wallet info' })
  getWallet(@CurrentUser() user: any) {
    return this.companySelfService.getCompanyWallet(user.companyId);
  }
}
