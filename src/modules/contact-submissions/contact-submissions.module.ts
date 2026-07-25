import { Module } from '@nestjs/common';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ContactSubmissionsController } from './contact-submissions.controller';
import { AdminContactSubmissionsController } from './admin-contact-submissions.controller';

@Module({
  controllers: [
    ContactSubmissionsController,
    AdminContactSubmissionsController,
  ],
  providers: [ContactSubmissionsService],
  exports: [ContactSubmissionsService],
})
export class ContactSubmissionsModule {}
