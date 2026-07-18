import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { TranslateHieroglyphicsDto } from './dto/translate-hieroglyphics.dto';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Public AI')
@Controller('ai')
// Strict rate limit: 10 requests per 1 hour to prevent abuse
@Throttle({ default: { limit: 10, ttl: 3600000 } })
export class PublicAiController {
  constructor(private readonly aiService: AiService) {}

  @Post('hieroglyphics')
  @ApiOperation({
    summary: 'Translate a name to ancient Egyptian Hieroglyphics',
  })
  @ApiOkResponse({ description: 'The generated hieroglyphics translation' })
  async translateHieroglyphics(@Body() dto: TranslateHieroglyphicsDto) {
    return this.aiService.translateHieroglyphics(dto);
  }
}
