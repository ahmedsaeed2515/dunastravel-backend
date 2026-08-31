import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('System')
@Controller()
@Public()
export class RootController {
  @Get()
  @ApiOperation({ summary: 'API Root & Service Status' })
  getRoot() {
    return {
      service: 'Dunas Travel Luxury API',
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      documentation: '/api/docs',
    };
  }
}
