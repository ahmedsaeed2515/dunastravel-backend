import { Controller, Post, Body, Ip } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiUnprocessableEntityResponse,
  ApiTooManyRequestsResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { ContactSubmissionsService } from './contact-submissions.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactSubmissionsController {
  constructor(
    private readonly contactSubmissionsService: ContactSubmissionsService,
  ) {}

  @Post()
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a contact inquiry' })
  @ApiBody({ type: CreateContactSubmissionDto })
  @ApiCreatedResponse({
    description: 'The contact submission was successfully received.',
    schema: {
      example: {
        data: {
          referenceCode: 'CON-A3F9K2',
          message:
            'Your message has been received. We will be in touch shortly.',
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({ description: 'Validation failed.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async create(
    @Body() createContactDto: CreateContactSubmissionDto,
    @Ip() ip: string,
  ) {
    let clientIp = ip;
    if (clientIp && clientIp.length > 45) {
      clientIp = clientIp.substring(0, 45);
    }

    const submission = await this.contactSubmissionsService.create(
      createContactDto,
      clientIp || null,
    );

    return {
      referenceCode: submission.referenceCode,
      message: 'Your message has been received. We will be in touch shortly.',
    };
  }
}
