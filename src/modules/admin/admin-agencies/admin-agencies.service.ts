import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyStatus, CompanyType, Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';

@Injectable()
export class AdminAgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly agencySelect = {
    id: true,
    referenceCode: true,
    name: true,
    companyType: true,
    status: true,
    email: true,
    phone: true,
    website: true,
    taxId: true,
    address: true,
    primaryContact: true,
    commissionRate: true,
    currentBalance: true,
    paymentTerms: true,
    contractStartDate: true,
    contractEndDate: true,
    tags: true,
    segments: true,
    tier: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.CompanySelect;

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: CompanyStatus;
  }) {
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );
    const where: Prisma.CompanyWhereInput = {
      companyType: CompanyType.AGENCY,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: this.agencySelect,
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const agency = await this.prisma.company.findFirst({
      where: { id, companyType: CompanyType.AGENCY, deletedAt: null },
      select: this.agencySelect,
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async updateStatus(id: string, status: CompanyStatus, actorId: string) {
    const existing = await this.findOne(id);
    if (existing.status === status) return existing;

    return this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.company.updateMany({
          where: {
            id,
            companyType: CompanyType.AGENCY,
            deletedAt: null,
            status: existing.status,
          },
          data: { status },
        });
        if (claimed.count !== 1) {
          throw new NotFoundException('Agency changed; reload and try again');
        }
        if (status !== CompanyStatus.ACTIVE) {
          await tx.user.updateMany({
            where: { companyId: id, deletedAt: null },
            data: {
              refreshToken: null,
              sessionVersion: { increment: 1 },
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId,
            actorRole: 'SUPER_ADMIN',
            action: 'AGENCY_STATUS_UPDATED',
            entityType: 'COMPANY',
            entityId: id,
            metadata: { oldStatus: existing.status, newStatus: status },
          },
        });
        return tx.company.findUniqueOrThrow({
          where: { id },
          select: this.agencySelect,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async updateTier(
    id: string,
    tier: string,
    commissionRate: number,
    actorId: string,
  ) {
    if (commissionRate < 0 || commissionRate > 100) {
      throw new BadRequestException(
        'Commission rate must be between 0 and 100',
      );
    }
    const existing = await this.findOne(id);
    const decimalRate = new Prisma.Decimal(commissionRate);
    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.company.update({
          where: { id },
          data: { tier, commissionRate: decimalRate },
          select: this.agencySelect,
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorRole: 'SUPER_ADMIN',
            action: 'AGENCY_COMMERCIAL_TERMS_UPDATED',
            entityType: 'COMPANY',
            entityId: id,
            metadata: {
              oldTier: existing.tier,
              newTier: tier,
              oldCommissionRate: existing.commissionRate.toString(),
              newCommissionRate: decimalRate.toString(),
            },
          },
        });
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
