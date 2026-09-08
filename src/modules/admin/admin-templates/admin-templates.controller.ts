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
import {
  SendTestEmailDto,
  BroadcastCampaignDto,
} from '../dto/email-template-broadcast.dto';
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

  @Get('presets')
  @ApiOperation({ summary: 'Get built-in luxury email template presets' })
  getPresets() {
    return this.adminTemplatesService.getPresets();
  }

  @Get()
  @ApiOperation({ summary: 'List all email templates' })
  async listTemplates() {
    return this.adminTemplatesService.listTemplates();
  }

  @Post('test-send')
  @ApiOperation({ summary: 'Send a test email with sample variables' })
  async sendTestEmail(
    @Body() dto: SendTestEmailDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.adminTemplatesService.sendTestEmail(
      dto,
      actor.id,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'EMAIL_TEST_SENT',
      entityType: 'EmailTemplate',
      entityId: dto.recipientEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return result;
  }

  @Post('broadcast')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Broadcast an email campaign to audience' })
  async broadcastCampaign(
    @Body() dto: BroadcastCampaignDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.adminTemplatesService.broadcastCampaign(
      dto,
      actor.id,
    );
    await this.auditService.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'EMAIL_CAMPAIGN_BROADCAST',
      entityType: 'EmailCampaign',
      entityId: result.campaignId,
      metadata: {
        recipientGroup: dto.recipientGroup,
        totalRecipients: result.totalRecipients,
        sentCount: result.sentCount,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific email template' })
  async getTemplate(@Param('id') id: string) {
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
    @Param('id') id: string,
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
    @Param('id') id: string,
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
