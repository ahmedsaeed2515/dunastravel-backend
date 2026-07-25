import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FaqService } from './faq.service';

@ApiTags('faq')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Get public FAQ items' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'locale', required: false, type: String })
  async findAll(
    @Query('category') category?: string,
    @Query('locale') locale: string = 'en',
  ) {
    return this.faqService.findAllPublic(category, locale);
  }
}
