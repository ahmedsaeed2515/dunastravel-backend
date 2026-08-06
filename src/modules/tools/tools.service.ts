import { Injectable } from '@nestjs/common';
import { TranslateHieroglyphicsDto } from './dto/tools.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ToolsService {
  constructor(private readonly aiService: AiService) {}

  async translateHieroglyphics(dto: TranslateHieroglyphicsDto) {
    const result = await this.aiService.translateHieroglyphics(dto);
    return { glyphs: result.translation };
  }
}
