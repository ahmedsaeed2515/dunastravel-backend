import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyStatus, CompanyType, Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';

@Injectable()
export class AdminAgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pageVal: number = 1, limitVal: number = 10, status?: string) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.CompanyWhereInput = {
      companyType: CompanyType.AGENCY,
      ...(status ? { status: status as CompanyStatus } : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const agency = await this.prisma.company.findFirst({
      where: { id, companyType: CompanyType.AGENCY },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async updateStatus(id: string, status: CompanyStatus) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { status },
    });
  }

  async updateTier(id: string, tier: string, commissionRate: number) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { tier, commissionRate: new Prisma.Decimal(commissionRate) },
    });
  }
}
