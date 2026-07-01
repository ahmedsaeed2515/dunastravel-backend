import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanySelfService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCompanyId(companyId?: string): string {
    if (!companyId) {
      throw new ForbiddenException(
        'Your account is not linked to a company. Contact your administrator.',
      );
    }
    return companyId;
  }

  async getCompanyBookings(companyId: string | undefined, page: string, limit: string) {
    const cid = this.requireCompanyId(companyId);
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { companyId: cid, deletedAt: null },
        select: {
          id: true,
          referenceCode: true,
          status: true,
          totalAmountUsd: true,
          arrivalDate: true,
          adults: true,
          children: true,
          tour: { select: { titleJsonb: true, slug: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.booking.count({ where: { companyId: cid, deletedAt: null } }),
    ]);

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async getCompanyCommissions(companyId: string | undefined, page: string, limit: string) {
    const cid = this.requireCompanyId(companyId);
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [data, total] = await Promise.all([
      this.prisma.commission.findMany({
        where: { companyId: cid },
        select: {
          id: true,
          rate: true,
          amount: true,
          status: true,
          createdAt: true,
          booking: { select: { referenceCode: true, totalAmountUsd: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.commission.count({ where: { companyId: cid } }),
    ]);

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async getCompanyWallet(companyId: string | undefined) {
    const cid = this.requireCompanyId(companyId);

    const wallet = await this.prisma.wallet.findFirst({
      where: { ownerType: 'COMPANY', ownerId: cid },
      select: {
        id: true,
        balance: true,
        currency: true,
        transactions: {
          select: { id: true, type: true, amount: true, status: true, description: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!wallet) throw new NotFoundException('Wallet not found for this company');
    return wallet;
  }
}
