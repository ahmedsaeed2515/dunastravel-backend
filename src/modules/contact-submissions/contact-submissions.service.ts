/* eslint-disable */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import {
  ContactCreatedEvent,
  CONTACT_CREATED_EVENT,
} from './events/contact-created.event';
import * as crypto from 'crypto';
import { sanitizeString } from '../../common/utils/sanitize.util';

@Injectable()
export class ContactSubmissionsService {
  private readonly logger = new Logger(ContactSubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateContactSubmissionDto, ipAddress: string | null) {
    const referenceCode = await this.generateUniqueReferenceCode();

    try {
      const submission = await this.prisma.contactSubmission.create({
        data: {
          referenceCode,
          firstName: sanitizeString(dto.firstName),
          lastName: sanitizeString(dto.lastName),
          email: sanitizeString(dto.email),
          phone: dto.phone ? sanitizeString(dto.phone) : null,
          subject: sanitizeString(dto.subject),
          message: sanitizeString(dto.message),
          locale: dto.locale || 'en',
          ipAddress,
        },
      });

      this.logger.log(
        `Contact submission created: Ref=${referenceCode}, Email=${this.maskEmail(submission.email)}, Subject="${submission.subject}"`,
      );

      const payload = new ContactCreatedEvent({
        referenceCode: submission.referenceCode,
        firstName: submission.firstName,
        lastName: submission.lastName,
        email: submission.email,
        phone: submission.phone || undefined,
        subject: submission.subject,
        message: submission.message,
        locale: submission.locale,
        submittedAt: submission.createdAt,
      });

      this.eventEmitter.emit(CONTACT_CREATED_EVENT, payload);
      this.logger.log(
        `Emitted event ${CONTACT_CREATED_EVENT} for Ref=${referenceCode}`,
      );

      return submission;
    } catch (error: any) {
      this.logger.error(
        `Failed to persist contact submission: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to process contact submission',
      );
    }
  }

  private async generateUniqueReferenceCode(): Promise<string> {
    const maxAttempts = 10;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (let i = 0; i < maxAttempts; i++) {
      let code = 'CON-';
      const bytes = crypto.randomBytes(6);
      for (let j = 0; j < 6; j++) {
        code += chars[bytes[j] % chars.length];
      }

      const existing = await this.prisma.contactSubmission.findUnique({
        where: { referenceCode: code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    this.logger.error(
      'Failed to generate unique reference code after maximum attempts.',
    );
    throw new InternalServerErrorException(
      'Failed to generate unique reference code after maximum attempts.',
    );
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const [local, domain] = parts;
    const visibleLocal = local.substring(0, 3);
    return `${visibleLocal}***@${domain}`;
  }
}
