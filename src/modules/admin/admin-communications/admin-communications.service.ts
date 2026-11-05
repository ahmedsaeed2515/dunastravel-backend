import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailDeliveryService } from '../../notifications/services/email-delivery.service';
import {
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  BroadcastCampaignDto,
  BroadcastAudience,
  SendTestEmailDto,
} from '../dto/email-template-broadcast.dto';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import { ListNotificationLogsQueryDto } from '../dto/list-notification-logs-query.dto';

export function wrapInLuxuryEmailTemplate(
  subject: string,
  contentHtml: string,
): string {
  // If the content already contains a full html doc, keep it
  if (contentHtml.includes('<html') || contentHtml.includes('<!DOCTYPE')) {
    return contentHtml;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0c0d0e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e5e5e5;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      max-width: 620px;
      margin: 30px auto;
      background: #141618;
      border: 1px solid #2a2824;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .email-header {
      background: linear-gradient(135deg, #1b1a17 0%, #101112 100%);
      padding: 35px 30px 25px;
      text-align: center;
      border-bottom: 1px solid #2a2824;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #d4af37;
      text-transform: uppercase;
      margin: 0;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 2px;
      color: #8c8273;
      text-transform: uppercase;
      margin-top: 6px;
    }
    .email-body {
      padding: 35px 30px;
      font-size: 15px;
      line-height: 1.7;
      color: #d1d5db;
    }
    .email-body h1, .email-body h2, .email-body h3 {
      color: #f3f4f6;
    }
    .email-body a {
      color: #d4af37;
      text-decoration: underline;
    }
    .email-footer {
      background: #0f1011;
      padding: 25px 30px;
      text-align: center;
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #202020;
    }
    .footer-links a {
      color: #a1a1aa;
      margin: 0 10px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <div class="brand-logo">DUNAS TRAVEL</div>
      <div class="brand-tagline">Exclusive Middle East Journeys</div>
    </div>
    <div class="email-body">
      ${contentHtml}
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 10px;">Dunas Travel &copy; ${new Date().getFullYear()} - All Rights Reserved.</p>
      <div class="footer-links">
        <a href="https://dunas-travel.com">Website</a> &bull;
        <a href="https://dunas-travel.com/tours">Experiences</a> &bull;
        <a href="mailto:info@dunas-travel.com">Contact Concierge</a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

@Injectable()
export class AdminCommunicationsService {
  private readonly logger = new Logger(AdminCommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: EmailDeliveryService,
  ) {}

  async getMetrics() {
    const [sent, failed, exhausted, pending] = await Promise.all([
      this.prisma.notificationDeliveryLog.count({
        where: { status: NotificationDeliveryStatus.SENT },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { status: NotificationDeliveryStatus.FAILED },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { status: NotificationDeliveryStatus.EXHAUSTED },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { status: NotificationDeliveryStatus.PENDING },
      }),
    ]);

    const totalFailed = failed + exhausted;
    const totalProcessed = sent + totalFailed;
    const successRate =
      totalProcessed > 0
        ? Math.round((sent / totalProcessed) * 1000) / 10
        : 100;

    return {
      totalSent: sent,
      totalFailed,
      totalPending: pending,
      successRate,
    };
  }

  async getLogs(
    filters: ListNotificationLogsQueryDto & { recipientEmail?: string },
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationDeliveryLogWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.recipientEmail) {
      where.recipientEmail = {
        contains: filters.recipientEmail.trim(),
        mode: 'insensitive',
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationDeliveryLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async retryNotification(id: string) {
    const log = await this.prisma.notificationDeliveryLog.findUnique({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(`Notification log with ID ${id} not found`);
    }

    await this.deliveryService.deliver({
      notificationType: log.notificationType,
      originReferenceCode: log.originReferenceCode,
      originEntityType: log.originEntityType,
      existingLogId: log.id,
      payload: {
        to: log.recipientEmail,
        subject: `[RETRY] Notification #${log.originReferenceCode}`,
        html: `<p>Retry notification for #${log.originReferenceCode}</p>`,
        text: `Retry notification for #${log.originReferenceCode}`,
      },
    });

    return { success: true, message: 'Notification re-sent successfully' };
  }

  async getTemplates() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTemplateById(id: string) {
    const tmpl = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!tmpl) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return tmpl;
  }

  async createTemplate(dto: CreateEmailTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        variables: dto.variables || [],
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateEmailTemplateDto) {
    await this.getTemplateById(id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.subject ? { subject: dto.subject } : {}),
        ...(dto.bodyHtml ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.variables ? { variables: dto.variables } : {}),
      },
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplateById(id);
    await this.prisma.emailTemplate.delete({ where: { id } });
    return { success: true };
  }

  async getPresets() {
    return [];
  }

  async sendTestEmail(dto: SendTestEmailDto, adminEmail?: string) {
    const targetEmail = dto.recipientEmail || adminEmail;
    if (!targetEmail) {
      throw new BadRequestException(
        'Recipient email is required for test send.',
      );
    }

    const styledHtml = wrapInLuxuryEmailTemplate(dto.subject, dto.bodyHtml);
    const plainText = stripHtml(dto.bodyHtml);

    await this.deliveryService.deliver(
      NotificationType.CUSTOMER_ACKNOWLEDGMENT,
      `TEST-${Date.now()}`,
      'CAMPAIGN_TEST',
      {
        to: targetEmail,
        subject: `[TEST] ${dto.subject}`,
        html: styledHtml,
        text: plainText,
      },
    );

    return {
      success: true,
      message: `Test email dispatched to ${targetEmail}`,
    };
  }

  async broadcastCampaign(dto: BroadcastCampaignDto) {
    let targetEmails: string[] = [];

    switch (dto.recipientGroup) {
      case BroadcastAudience.CUSTOM_LIST:
        targetEmails = (dto.customEmails || [])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@'));
        break;

      case BroadcastAudience.VERIFIED_CUSTOMERS: {
        const users = await this.prisma.user.findMany({
          where: { deletedAt: null, isVerified: true },
          select: { email: true },
        });
        targetEmails = users.map((u) => u.email.trim().toLowerCase());
        break;
      }

      case BroadcastAudience.MARKETING_OPT_IN: {
        const users = await this.prisma.user.findMany({
          where: { deletedAt: null, marketingConsent: true },
          select: { email: true },
        });
        targetEmails = users.map((u) => u.email.trim().toLowerCase());
        break;
      }

      case BroadcastAudience.ALL_USERS:
      default: {
        const users = await this.prisma.user.findMany({
          where: { deletedAt: null },
          select: { email: true },
        });
        targetEmails = users.map((u) => u.email.trim().toLowerCase());
        break;
      }
    }

    // Deduplicate
    const uniqueRecipients = Array.from(new Set(targetEmails)).filter((e) =>
      Boolean(e && e.includes('@')),
    );

    const campaignId = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const campaignName = dto.campaignName || dto.subject;

    if (uniqueRecipients.length === 0) {
      return {
        success: false,
        campaignId,
        campaignName,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
      };
    }

    const styledHtml = wrapInLuxuryEmailTemplate(dto.subject, dto.bodyHtml);
    const plainText = stripHtml(dto.bodyHtml);

    this.logger.log(
      `Starting broadcast [${campaignId}] to ${uniqueRecipients.length} recipients (Group: ${dto.recipientGroup})`,
    );

    let sentCount = 0;
    let failedCount = 0;

    // Dispatch in concurrent batches of 5 to respect Brevo rate limits
    const batches = chunkArray(uniqueRecipients, 5);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (email) => {
          try {
            await this.deliveryService.deliver(
              NotificationType.CUSTOMER_ACKNOWLEDGMENT,
              campaignId,
              'CAMPAIGN',
              {
                to: email,
                subject: dto.subject,
                html: styledHtml,
                text: plainText,
                tags: {
                  campaignId,
                  recipientGroup: dto.recipientGroup,
                },
              },
            );
            sentCount++;
          } catch (err: any) {
            this.logger.error(
              `Failed delivering broadcast to ${email}: ${err.message}`,
            );
            failedCount++;
          }
        }),
      );
    }

    this.logger.log(
      `Broadcast [${campaignId}] finished. Sent: ${sentCount}, Failed: ${failedCount}`,
    );

    return {
      success: sentCount > 0,
      campaignId,
      campaignName,
      totalRecipients: uniqueRecipients.length,
      sentCount,
      failedCount,
    };
  }
}
