import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import {
  sanitizeEmailTemplateHtml,
  sanitizePlainText,
} from '../../../common/utils/content-sanitizer.util';

@Injectable()
export class AdminTemplatesService {
  private readonly logger = new Logger(AdminTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listTemplates() {
    this.logger.log('Listing email templates');
    const templates = await this.prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return templates.map((template) => ({
      ...template,
      subject: this.sanitizeSubject(template.subject),
      bodyHtml: sanitizeEmailTemplateHtml(template.bodyHtml),
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
