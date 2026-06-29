import { Module } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { PublicInquiriesController } from './public-inquiries.controller';
import { InquiriesController } from './inquiries.controller';

@Module({
  controllers: [PublicInquiriesController, InquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
