import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { InAppNotificationsService } from './in-app-notifications.service';
import { ListInAppNotificationsQueryDto } from './dto/in-app-notification.dto';

@ApiTags('In-App Notifications')
@ApiBearerAuth()
@Controller('in-app-notifications')
@UseGuards(JwtAuthGuard)
export class InAppNotificationsController {
  constructor(
    private readonly notificationsService: InAppNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user in-app notifications' })
  @ApiOkResponse({ description: 'Paginated notifications list with unreadCount' })
  async getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInAppNotificationsQueryDto,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ description: 'Unread count object' })
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'Count of notifications marked read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiOkResponse({ description: 'Updated notification object' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
