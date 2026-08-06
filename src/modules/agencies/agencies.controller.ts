import { Controller, Post, Body } from '@nestjs/common';
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

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Register a new B2B agency' })
  async register(@Body() dto: RegisterAgencyDto) {
    return this.agenciesService.registerAgency(dto);
  }
}
