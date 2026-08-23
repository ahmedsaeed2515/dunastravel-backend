import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto, UpdateAgentDto, AgentQueryDto } from './dto/agent.dto';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { assertStrongPassword } from '../../common/utils/password-policy.util';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSuperAdmin(actor: { id: string; role: string }): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only super administrators can manage agent accounts',
      );
    }
  }

  async findAll(query: AgentQueryDto) {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: UserRole.AGENT,
      deletedAt: null,
    };
    if (query.companyId) where.companyId = query.companyId;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyId: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id, role: UserRole.AGENT, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true, referenceCode: true } },
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(
    dto: CreateAgentDto,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    assertStrongPassword(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customerNumber = `AGT-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          email: { equals: dto.email.trim(), mode: 'insensitive' },
        },
      });
      if (existing) throw new ConflictException('Email already in use');

      if (dto.companyId) {
        const company = await tx.company.findFirst({
          where: { id: dto.companyId, status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        if (!company) throw new NotFoundException('Company not found');
      }

      const agent = await tx.user.create({
        data: {
          name: sanitizePlainText(dto.name).slice(0, 255),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone,
          passwordHash,
          role: UserRole.AGENT,
          customerNumber,
          companyId: dto.companyId ?? null,
          isVerified: true, // Admin-created agents are pre-verified
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'AGENT_CREATED',
          entityType: 'User',
          entityId: agent.id,
          metadata: { companyId: agent.companyId },
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        companyId: agent.companyId,
        role: agent.role,
        status: agent.status,
        customerNumber: agent.customerNumber,
        isVerified: agent.isVerified,
        createdAt: agent.createdAt,
      };
    });
  }

  async update(
    id: string,
    dto: UpdateAgentDto,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.user.findFirst({
        where: { id, role: UserRole.AGENT, deletedAt: null },
      });
      if (!agent) throw new NotFoundException('Agent not found');
      if (dto.companyId) {
        const company = await tx.company.findFirst({
          where: { id: dto.companyId, status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        if (!company) throw new NotFoundException('Company not found');
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          name:
            dto.name !== undefined
              ? sanitizePlainText(dto.name).slice(0, 255)
              : undefined,
          phone: dto.phone,
          companyId: dto.companyId,
          ...(dto.companyId !== undefined && dto.companyId !== agent.companyId
            ? {
                refreshToken: null,
                sessionVersion: { increment: 1 },
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyId: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'AGENT_UPDATED',
          entityType: 'User',
          entityId: id,
          metadata: { changedFields: Object.keys(dto) },
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return updated;
    });
  }

  async remove(
    id: string,
    actor: { id: string; role: string },
    reqDetails?: { ipAddress?: string; userAgent?: string },
  ) {
    this.assertSuperAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.user.findFirst({
        where: { id, role: UserRole.AGENT, deletedAt: null },
      });
      if (!agent) throw new NotFoundException('Agent not found');

      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
          refreshToken: null,
          sessionVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'AGENT_DELETED',
          entityType: 'User',
          entityId: id,
          ipAddress: reqDetails?.ipAddress || null,
          userAgent: reqDetails?.userAgent || null,
        },
      });

      return { message: 'Agent deleted successfully' };
    });
  }
}
