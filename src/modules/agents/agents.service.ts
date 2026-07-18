import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto, UpdateAgentDto, AgentQueryDto } from './dto/agent.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AgentQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: any = { role: UserRole.AGENT, deletedAt: null };
    if (query.companyId) where.companyId = query.companyId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyId: true,
          status: true,
          createdAt: true,
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
        status: true,
        createdAt: true,
        company: { select: { id: true, name: true, referenceCode: true } },
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(dto: CreateAgentDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const count = await this.prisma.user.count();
    const customerNumber = `AGT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const agent = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.AGENT,
        customerNumber,
        companyId: dto.companyId ?? null,
        isVerified: true, // Admin-created agents are pre-verified
      },
    });

    const { passwordHash: _ph, refreshToken: _rt, ...safeAgent } = agent as any;
    return safeAgent;
  }

  async update(id: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.user.findFirst({
      where: { id, role: UserRole.AGENT, deletedAt: null },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        companyId: dto.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyId: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id, role: UserRole.AGENT, deletedAt: null },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Agent deleted successfully' };
  }
}
