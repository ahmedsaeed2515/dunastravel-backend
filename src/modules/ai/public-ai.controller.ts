import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { TranslateHieroglyphicsDto } from './dto/translate-hieroglyphics.dto';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public AI')
@Controller('ai')
@Public()
@Throttle({ default: { limit: 5, ttl: 3_600_000 } })
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
