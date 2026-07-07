import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryLogQueryFilters } from './dto/notification.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin - Communications & Notifications')
@Controller('admin/communications/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get global communication delivery metrics' })
  async getMetrics() {
    return this.notificationsService.getMetrics();
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List notification delivery logs with pagination' })
  async findAll(@Query() filters: NotificationDeliveryLogQueryFilters) {
    return this.notificationsService.findAllLogs(filters);
  }

  @Post(':id/retry')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manually retry a failed notification' })
  async retryNotification(@Param('id') id: string) {
    return this.notificationsService.retryNotification(id);
  }
}
