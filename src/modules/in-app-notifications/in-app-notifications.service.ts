import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListInAppNotificationsQueryDto,
  CreateInAppNotificationDto,
} from './dto/in-app-notification.dto';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
  UserRole,
} from '@prisma/client';

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(dto: CreateInAppNotificationDto) {
    return this.prisma.inAppNotification.create({
      data: {
        userId: dto.userId,
        category: dto.category || InAppNotificationCategory.SYSTEM,
        priority: dto.priority || InAppNotificationPriority.NORMAL,
        title: dto.title,
        message: dto.message,
        targetApp: dto.targetApp || 'ADMIN',
        entityType: dto.entityType,
        entityId: dto.entityId,
        deepLink: dto.deepLink,
        metadata: dto.metadata || null,
      },
    });
  }

  async notifyAdmins(options: {
    category?: InAppNotificationCategory;
    priority?: InAppNotificationPriority;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    deepLink?: string;
    metadata?: any;
  }) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!admins.length) return;

    const notifications = admins.map((admin) => ({
      userId: admin.id,
      category: options.category || InAppNotificationCategory.SYSTEM,
      priority: options.priority || InAppNotificationPriority.NORMAL,
      title: options.title,
      message: options.message,
      targetApp: 'ADMIN',
      entityType: options.entityType,
      entityId: options.entityId,
      deepLink: options.deepLink,
      metadata: options.metadata || null,
    }));

    await this.prisma.inAppNotification.createMany({
      data: notifications,
    });

    this.logger.log(
      `Created ${notifications.length} admin in-app notification(s) for event: ${options.title}`,
    );
  }

  async getUserNotifications(
    userId: string,
    query: ListInAppNotificationsQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.category) {
      where.category = query.category;
    }
    if (query.isRead !== undefined) {
      where.isRead = query.isRead === 'true';
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inAppNotification.count({ where }),
      this.prisma.inAppNotification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      items,
      unreadCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.inAppNotification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.inAppNotification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this notification',
      );
    }

    return this.prisma.inAppNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const res = await this.prisma.inAppNotification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return { count: res.count };
  }
}
