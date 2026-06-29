import { Module } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { PublicInquiriesController } from './public-inquiries.controller';

@Module({
  controllers: [PublicInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
