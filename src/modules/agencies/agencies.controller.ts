import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { RegisterAgencyDto } from './dto/register-agency.dto';

@ApiTags('Agencies')
@Controller('agencies')
@Public()
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get('verify-partner/:code')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Instant verification for 8-digit IATA / Partner Code',
  })
  async verifyPartner(@Param('code') code: string) {
    return this.agenciesService.verifyPartnerCode(code);
  }

  @Get('verify-iata/:code')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Alias for verifying 8-digit IATA code' })
  async verifyIata(@Param('code') code: string) {
    return this.agenciesService.verifyPartnerCode(code);
  }

  @Post('verify-partner')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Post-body partner verification' })
  async verifyPartnerBody(@Body() body: { code: string }) {
    return this.agenciesService.verifyPartnerCode(body?.code);
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Register a new B2B agency' })
  async register(@Body() dto: RegisterAgencyDto) {
    return this.agenciesService.registerAgency(dto);
  }
}
