import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminTemplatesService } from './admin-templates.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import { AuditService } from '../../audit/audit.service';
import { Request } from 'express';

@ApiTags('Admin Templates')
@ApiBearerAuth()
@Controller('admin/communications/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTemplatesController {
  constructor(
    private readonly adminTemplatesService: AdminTemplatesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates' })
  async listTemplates() {
    return this.adminTemplatesService.listTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific email template' })
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTemplatesService.getTemplate(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new email template' })
  async createTemplate(
    @Body() dto: CreateEmailTemplateDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const template = await this.adminTemplatesService.createTemplate(
      dto,
      actor.id,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'EMAIL_TEMPLATE_CREATED',
      entityType: 'EmailTemplate',
      entityId: template.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return template;
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing email template' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const template = await this.adminTemplatesService.updateTemplate(
      id,
      dto,
      actor.id,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'EMAIL_TEMPLATE_UPDATED',
      entityType: 'EmailTemplate',
      entityId: id,
      metadata: { changedFields: Object.keys(dto) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return template;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an email template' })
  async deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.adminTemplatesService.deleteTemplate(
      id,
      actor.id,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'EMAIL_TEMPLATE_DELETED',
      entityType: 'EmailTemplate',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return result;
  }
}
