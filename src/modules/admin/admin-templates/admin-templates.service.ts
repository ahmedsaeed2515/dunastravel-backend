import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';

@Injectable()
export class AdminTemplatesService {
  private readonly logger = new Logger(AdminTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTemplates() {
    this.logger.log('Listing email templates');
    return this.prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async createTemplate(dto: CreateEmailTemplateDto, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} creating template ${dto.name}`);
    const existing = await this.prisma.emailTemplate.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Template with this name already exists');
    }

    return this.prisma.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        variables: dto.variables || null,
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateEmailTemplateDto, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} updating template ${id}`);
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');

    if (dto.name && dto.name !== template.name) {
      const existing = await this.prisma.emailTemplate.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException('Template with this name already exists');
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.subject && { subject: dto.subject }),
        ...(dto.bodyHtml && { bodyHtml: dto.bodyHtml }),
        ...(dto.variables !== undefined && { variables: dto.variables }),
      },
    });
  }

  async deleteTemplate(id: string, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} deleting template ${id}`);
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');

    await this.prisma.emailTemplate.delete({ where: { id } });
    return { message: 'Template deleted successfully' };
  }
}
