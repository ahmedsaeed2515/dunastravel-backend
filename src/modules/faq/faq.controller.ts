import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FaqService } from './faq.service';
import { Public } from '../../common/decorators/public.decorator';
import { PublicFaqQueryDto } from './dto/faq-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('faq')
@Controller(['faq', 'faqs'])
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Get public FAQ items' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'locale', required: false, type: String })
  async findAll(@Query() query: PublicFaqQueryDto) {
    return this.faqService.findAllPublic(
      query.category,
      query.locale ?? 'en',
    );
  }
}
