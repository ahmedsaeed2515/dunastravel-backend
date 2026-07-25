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

@ApiTags('Inquiries (Public)')
@Controller()
export class PublicInquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post(['inquiries', 'inquiries/tailor-made', 'tailor-tour'])
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
