import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import { UserRole } from '@prisma/client';
import { AdminCommunicationsService } from './admin-communications.service';
import {
  BroadcastCampaignDto,
  SendTestEmailDto,
} from '../dto/email-template-broadcast.dto';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import { ListNotificationLogsQueryDto } from '../dto/list-notification-logs-query.dto';

@ApiTags('Admin Communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/communications')
export class AdminCommunicationsController {
  constructor(
    private readonly communicationsService: AdminCommunicationsService,
  ) {}

  @Get('logs/metrics')
  @ApiOperation({ summary: 'Get overall communication delivery metrics' })
  async getMetrics() {
    return this.communicationsService.getMetrics();
  }

  @Get('logs')
  @ApiOperation({ summary: 'List notification delivery logs with filters' })
  async getLogs(
    @Query()
    filters: ListNotificationLogsQueryDto & { recipientEmail?: string },
  ) {
    return this.communicationsService.getLogs(filters);
  }

  @Post('logs/:id/retry')
  @ApiOperation({ summary: 'Retry a failed notification delivery log' })
  @ApiParam({ name: 'id', description: 'Log UUID' })
  async retryNotification(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.retryNotification(id);
  }

  @Get('templates/presets')
  @ApiOperation({ summary: 'Get list of template presets' })
  async getPresets() {
    return this.communicationsService.getPresets();
  }

  @Post('templates/test-send')
  @ApiOperation({ summary: 'Send a test email to verify layout and delivery' })
  async sendTestEmail(
    @Body() dto: SendTestEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.sendTestEmail(dto, user.email);
  }

  @Post('templates/broadcast')
  @ApiOperation({ summary: 'Broadcast email campaign to targeted audience' })
  async broadcastCampaign(@Body() dto: BroadcastCampaignDto) {
    return this.communicationsService.broadcastCampaign(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List email templates' })
  async getTemplates() {
    return this.communicationsService.getTemplates();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get a specific email template by ID' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async getTemplateById(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.getTemplateById(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new email template' })
  async createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.communicationsService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update an existing email template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.communicationsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete an email template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  async deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.communicationsService.deleteTemplate(id);
  }
}
