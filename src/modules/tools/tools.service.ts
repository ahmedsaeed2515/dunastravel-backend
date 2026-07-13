import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TranslateHieroglyphicsDto } from './dto/tools.dto';

@Injectable()
export class ToolsService {
  private anthropic!: Anthropic;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async translateHieroglyphics(dto: TranslateHieroglyphicsDto) {
    if (!this.anthropic) {
      throw new InternalServerErrorException('AI Service is not configured');
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Translate the following name into ancient Egyptian Hieroglyphics: "${dto.text}". Return a JSON object ONLY with no markdown, like {"glyphs": "hieroglyph characters here", "translit": "transliteration here"}.`
          }
        ]
      });

      const text = (response.content[0] as any).text;
      return JSON.parse(text);
    } catch (error) {
      // Return a fallback so the frontend doesn't crash completely, or let frontend handle the 500 error and fallback.
      throw new InternalServerErrorException('Failed to communicate with AI Service');
    }
  }
}
