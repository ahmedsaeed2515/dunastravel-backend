import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|credential|card|cvv|passport|sessionurl|authorization|cookie/i;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private redactMetadata(
    metadata?: Record<string, unknown>,
    depth = 0,
  ): Record<string, unknown> | null {
    if (!metadata || depth > 5) return null;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata).slice(0, 100)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 100).map((item) => {
          if (item && typeof item === 'object') {
            return this.redactMetadata(
              item as Record<string, unknown>,
              depth + 1,
            );
          }
          return typeof item === 'string' ? item.slice(0, 1000) : item;
        });
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.redactMetadata(
          value as Record<string, unknown>,
          depth + 1,
        );
      } else {
        sanitized[key] =
          typeof value === 'string' ? value.slice(0, 1000) : value;
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
    } catch {
      // Audit failure must NEVER crash the main request
      this.logger.error('AuditLog write failed');
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
      const from = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const to = query.dateTo ? new Date(query.dateTo) : undefined;
      if (
        from &&
        to &&
        (from > to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000)
      ) {
        throw new BadRequestException(
          'Audit date range must be no longer than 366 days',
        );
      }
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
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
