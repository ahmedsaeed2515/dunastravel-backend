import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ToolsService } from './tools.service';
import { TranslateHieroglyphicsDto } from './dto/tools.dto';
import { Public } from '../../common/decorators';

@ApiTags('Tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Public()
  @Post('hieroglyphics')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 requests per minute per IP
  @ApiOperation({ summary: 'Translate name to Hieroglyphics via AI' })
  async translateHieroglyphics(@Body() dto: TranslateHieroglyphicsDto) {
    return this.toolsService.translateHieroglyphics(dto);
  }
}
