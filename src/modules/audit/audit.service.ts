import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { getPaginationParams, paginate } from '../../common/utils';

export interface AuditOptions {
  actorId?: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ListAuditQueryDto {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'creditCard',
  'cardNumber',
  'cvv',
  'token',
  'refreshToken',
  'resetToken',
  'secret',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private redactMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!metadata) return null;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (REDACTED_KEYS.has(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.redactMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async log(opts: AuditOptions): Promise<void> {
    try {
      const sanitizedMeta = this.redactMetadata(opts.metadata);
      await this.prisma.auditLog.create({
        data: {
          actorId: opts.actorId ?? null,
          actorRole: opts.actorRole ?? null,
          action: opts.action,
          entityType: opts.entityType ?? null,
          entityId: opts.entityId ?? null,
          metadata: (sanitizedMeta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          ipAddress: opts.ipAddress ?? null,
          userAgent: opts.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit failure must NEVER crash the main request
      this.logger.error(`AuditLog write failed: ${(err as Error).message}`, {
        opts,
      });
    }
  }

  async findAllAdmin(query: ListAuditQueryDto) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);

    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.actorId) where.actorId = query.actorId;
    if (query.actorRole) where.actorRole = query.actorRole;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return paginate(items, total, page, limit);
  }
}
