import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(opts: AuditOptions): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: opts.actorId ?? null,
          actorRole: opts.actorRole ?? null,
          action: opts.action,
          entityType: opts.entityType ?? null,
          entityId: opts.entityId ?? null,
          metadata: (opts.metadata ?? null) as any,
          ipAddress: opts.ipAddress ?? null,
          userAgent: opts.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit failure must NEVER crash the main request
      this.logger.error(`AuditLog write failed: ${(err as Error).message}`, { opts });
    }
  }
}
