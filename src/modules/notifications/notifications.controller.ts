import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryLogQueryFilters } from './dto/notification.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { Request } from 'express';

@ApiTags('Admin - Communications & Notifications')
@Controller('admin/communications/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get global communication delivery metrics' })
  async getMetrics() {
    return this.notificationsService.getMetrics();
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List notification delivery logs with pagination' })
  async findAll(@Query() filters: NotificationDeliveryLogQueryFilters) {
    return this.notificationsService.findAllLogs(filters);
  }

  @Post(':id/retry')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Manually retry a failed notification' })
  @ApiResponse({ status: 200, description: 'Retry was accepted by the notification service.' })
  @ApiResponse({ status: 403, description: 'Requires ADMIN or SUPER_ADMIN role.' })
  @ApiResponse({ status: 404, description: 'Notification delivery log not found.' })
  @ApiResponse({ status: 429, description: 'Retry throttle exceeded.' })
  async retryNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.notificationsService.retryNotification(id);
    await this.auditService.log({
      actorId: actor?.id || 'system-admin',
      actorRole: actor?.role || 'ADMIN',
      action: 'NOTIFICATION_RETRIED',
      entityType: 'NotificationDeliveryLog',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return result;
  }
}
