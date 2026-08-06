import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { InquiriesService } from './inquiries.service';
import { CreateInquiryDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Inquiries (Public)')
@Controller()
@Public()
export class PublicInquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post('inquiries')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a new tailor-made tour inquiry' })
  @ApiCreatedResponse({ description: 'Inquiry successfully submitted' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async create(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.create(dto);
  }
}
