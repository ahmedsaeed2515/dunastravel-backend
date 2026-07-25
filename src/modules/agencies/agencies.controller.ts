import { Controller, Post, Body } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Agencies')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new B2B agency' })
  async register(@Body() dto: any) {
    return this.agenciesService.registerAgency(dto);
  }
}
