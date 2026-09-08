import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import {
  SendTestEmailDto,
  BroadcastCampaignDto,
  BroadcastAudience,
} from '../dto/email-template-broadcast.dto';
import {
  sanitizeEmailTemplateHtml,
  sanitizePlainText,
  sanitizeEmailHtml,
} from '../../../common/utils/content-sanitizer.util';
import { EmailDeliveryService } from '../../notifications/services/email-delivery.service';
import { NotificationType } from '../../notifications/types';
import {
  EMAIL_PRESETS,
  compileTemplateHtml,
  extractDesignConfigFromHtml,
  EmailDesignConfig,
} from './template-compiler.util';

@Injectable()
export class AdminTemplatesService {
  private readonly logger = new Logger(AdminTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  getPresets() {
    return Object.entries(EMAIL_PRESETS).map(([id, p]) => ({
      id,
      name: p.name,
      nameAr: p.nameAr,
      config: p.config,
      sampleHtml: compileTemplateHtml(p.config),
    }));
  }

  compileDesign(config: EmailDesignConfig): string {
    return compileTemplateHtml(config);
  }

  async listTemplates() {
    this.logger.log('Listing email templates');
    const templates = await this.prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return templates.map((template) => ({
      ...template,
      subject: this.sanitizeSubject(template.subject),
      bodyHtml: sanitizeEmailTemplateHtml(template.bodyHtml),
      designConfig: extractDesignConfigFromHtml(template.bodyHtml),
    }));
  }

  async getTemplate(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Template not found');
    return {
      ...template,
      subject: this.sanitizeSubject(template.subject),
      bodyHtml: sanitizeEmailTemplateHtml(template.bodyHtml),
      designConfig: extractDesignConfigFromHtml(template.bodyHtml),
    };
  }

  async createTemplate(dto: CreateEmailTemplateDto, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} creating an email template`);
    const name = dto.name.trim().toLowerCase();
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ConflictException('Template with this name already exists');
    }

    const bodyHtml = sanitizeEmailTemplateHtml(dto.bodyHtml);
    const subject = this.sanitizeSubject(dto.subject);
    const variables = this.extractVariables(subject, bodyHtml);
    const created = await this.prisma.emailTemplate.create({
      data: {
        name,
        subject,
        bodyHtml,
        variables:
          variables.length > 0
            ? (variables as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
    await this.cacheManager.del(`email_template:${created.name}`);
    return created;
  }

  async updateTemplate(
    id: string,
    dto: UpdateEmailTemplateDto,
    adminUserId: string,
  ) {
    this.logger.log(`Admin ${adminUserId} updating an email template`);
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Template not found');

    const name = dto.name?.trim().toLowerCase() ?? template.name;
    if (name !== template.name) {
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { name },
      });
      if (existing)
        throw new ConflictException('Template with this name already exists');
    }

    const subject =
      dto.subject !== undefined
        ? this.sanitizeSubject(dto.subject)
        : template.subject;
    const bodyHtml =
      dto.bodyHtml !== undefined
        ? sanitizeEmailTemplateHtml(dto.bodyHtml)
        : template.bodyHtml;
    const variables = this.extractVariables(subject, bodyHtml);
    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        bodyHtml,
        variables:
          variables.length > 0
            ? (variables as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
    await Promise.all([
      this.cacheManager.del(`email_template:${template.name}`),
      this.cacheManager.del(`email_template:${updated.name}`),
    ]);
    return updated;
  }

  async deleteTemplate(id: string, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} deleting an email template`);
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Template not found');

    await this.prisma.emailTemplate.delete({ where: { id } });
    await this.cacheManager.del(`email_template:${template.name}`);
    return { message: 'Template deleted successfully' };
  }

  async sendTestEmail(dto: SendTestEmailDto, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} sending a test email to ${dto.recipientEmail}`,
    );

    const defaultVariables: Record<string, string> = {
      name: 'Valued Guest',
      otpCode: '849201',
      verifyUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?email=${encodeURIComponent(dto.recipientEmail)}`,
      bookingRef: 'BKG-DUNAS-7890',
      tourTitle: 'Pharaohs & Nile Exclusive Cruise',
      date: new Date().toLocaleDateString(),
      email: dto.recipientEmail,
      ...dto.sampleVariables,
    };

    let subject = this.sanitizeSubject(dto.subject);
    let html = sanitizeEmailTemplateHtml(dto.bodyHtml);

    for (const [key, value] of Object.entries(defaultVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    }

    const payload = {
      to: dto.recipientEmail,
      subject: `[TEST] ${subject}`,
      html: sanitizeEmailHtml(html),
      text: sanitizePlainText(html).slice(0, 50_000),
      tags: { notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT },
    };

    const delivered = await this.emailDelivery.deliver(
      NotificationType.CUSTOMER_ACKNOWLEDGMENT,
      'TEST_EMAIL',
      'ADMIN_PREVIEW',
      payload,
    );

    return {
      success: delivered,
      recipient: dto.recipientEmail,
      message: delivered
        ? 'Test email dispatched successfully'
        : 'Failed to deliver test email',
    };
  }

  async broadcastCampaign(dto: BroadcastCampaignDto, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} initiating broadcast campaign to audience: ${dto.recipientGroup}`,
    );

    let recipients: { email: string; name: string }[] = [];

    switch (dto.recipientGroup) {
      case BroadcastAudience.ALL_USERS:
        recipients = await this.prisma.user.findMany({
          where: { status: 'ACTIVE', deletedAt: null },
          select: { email: true, name: true },
        });
        break;

      case BroadcastAudience.VERIFIED_CUSTOMERS:
        recipients = await this.prisma.user.findMany({
          where: { status: 'ACTIVE', isVerified: true, deletedAt: null },
          select: { email: true, name: true },
        });
        break;

      case BroadcastAudience.MARKETING_OPT_IN:
        recipients = await this.prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            marketingConsent: true,
            deletedAt: null,
          },
          select: { email: true, name: true },
        });
        break;

      case BroadcastAudience.CUSTOM_LIST:
        if (!dto.customEmails || dto.customEmails.length === 0) {
          throw new BadRequestException(
            'Custom recipient emails list is required when audience is CUSTOM_LIST',
          );
        }
        recipients = dto.customEmails.map((email) => ({
          email,
          name: 'Valued Client',
        }));
        break;

      default:
        throw new BadRequestException('Invalid recipient group');
    }

    if (recipients.length === 0) {
      throw new BadRequestException(
        'No active recipients found for the selected audience group',
      );
    }

    const campaignId = `CAMP-${Date.now().toString(36).toUpperCase()}`;
    const rawSubject = this.sanitizeSubject(dto.subject);
    const rawHtml = sanitizeEmailTemplateHtml(dto.bodyHtml);

    let sentCount = 0;
    let failedCount = 0;

    const BATCH_SIZE = 10;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (r) => {
          try {
            const recipientVars: Record<string, string> = {
              name: r.name || 'Valued Client',
              email: r.email,
              bookingRef: 'DUNAS-VIP',
              date: new Date().toLocaleDateString(),
            };

            let personalizedHtml = rawHtml;
            let personalizedSubject = rawSubject;

            for (const [key, val] of Object.entries(recipientVars)) {
              const regex = new RegExp(`{{${key}}}`, 'g');
              personalizedHtml = personalizedHtml.replace(regex, val);
              personalizedSubject = personalizedSubject.replace(regex, val);
            }

            const payload = {
              to: r.email,
              subject: personalizedSubject,
              html: sanitizeEmailHtml(personalizedHtml),
              text: sanitizePlainText(personalizedHtml).slice(0, 50_000),
              tags: {
                campaignId,
                campaignName: dto.campaignName || 'Broadcast',
              },
            };

            const delivered = await this.emailDelivery.deliver(
              NotificationType.CUSTOMER_ACKNOWLEDGMENT,
              campaignId,
              'CAMPAIGN_BROADCAST',
              payload,
            );

            if (delivered) {
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (err) {
            this.logger.error(`Broadcast failed for ${r.email}: ${err}`);
            failedCount++;
          }
        }),
      );
    }

    return {
      success: sentCount > 0,
      campaignId,
      campaignName: dto.campaignName || 'Broadcast Campaign',
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
    };
  }

  private sanitizeSubject(subject: string): string {
    return sanitizePlainText(subject)
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 255);
  }

  private extractVariables(subject: string, bodyHtml: string): string[] {
    const variables = new Set<string>();
    const template = `${subject}\n${bodyHtml}`;
    for (const match of template.matchAll(/{{([A-Za-z][A-Za-z0-9_]*)}}/g)) {
      variables.add(match[1]);
    }
    return [...variables].slice(0, 50);
  }
}
