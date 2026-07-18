import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  CreateCommissionDto,
  CommissionQueryFilters,
  UpdateCommissionStatusDto,
} from './dto/commission.dto';
import {
  CommissionStatus,
  WalletOwnerType,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  async createCommission(data: CreateCommissionDto) {
    // Check if commission already exists for this booking
    const existing = await this.prisma.commission.findUnique({
      where: { bookingId: data.bookingId },
    });

    if (existing) {
      throw new BadRequestException(
        'Commission already exists for this booking.',
      );
    }

    // Task 18: Cross-check amount vs company commission rate × booking total
    const [booking, company] = await Promise.all([
      this.prisma.booking.findUnique({
        where: { id: data.bookingId },
        select: { totalAmountUsd: true },
      }),
      this.prisma.company.findUnique({
        where: { id: data.companyId },
        select: { commissionRate: true },
      }),
    ]);

    if (!booking) throw new BadRequestException('Booking not found');
    if (!company) throw new BadRequestException('Company not found');

    const expectedAmount = booking.totalAmountUsd
      .mul(company.commissionRate)
      .div(100);
    const tolerance = 0.01; // 1 cent tolerance for rounding
    const diff = Math.abs(Number(data.amount) - Number(expectedAmount));

    if (diff > tolerance) {
      this.logger.warn(
        `Commission amount mismatch: submitted=${data.amount} expected=${expectedAmount} bookingId=${data.bookingId}`,
      );
      throw new BadRequestException(
        `Commission amount ${data.amount} does not match expected ${expectedAmount} (${company.commissionRate}% of ${booking.totalAmountUsd}). Please verify the amount.`,
      );
    }

    return this.prisma.commission.create({
      data: {
        companyId: data.companyId,
        bookingId: data.bookingId,
        rate: data.rate,
        amount: data.amount,
        status: CommissionStatus.PENDING,
      },
    });
  }

  async updateCommissionStatus(id: string, data: UpdateCommissionStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findUnique({ where: { id } });
      if (!commission) throw new NotFoundException('Commission not found');

      // If no change, return
      if (commission.status === data.status) return commission;

      const updated = await tx.commission.update({
        where: { id },
        data: { status: data.status },
      });

      // If transitioning to APPROVED, credit the company's wallet
      if (
        data.status === CommissionStatus.APPROVED &&
        commission.status === CommissionStatus.PENDING
      ) {
        // We use the WalletsService for consistency, but we pass `tx` implicitly if we could.
        // Actually, since WalletsService uses its own $transaction, it's safer to just call it.
        // But doing it outside this tx is better to avoid nested tx issues in Prisma.
      }

      return updated;
    });
  }

  // Helper function to trigger wallet credit. Should be called after the transaction commits.
  async processCommissionApproval(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (commission?.status === CommissionStatus.APPROVED) {
      await this.walletsService.addTransaction({
        ownerType: WalletOwnerType.COMPANY,
        ownerId: commission.companyId,
        amount: Number(commission.amount),
        type: WalletTransactionType.CREDIT,
        referenceType: 'COMMISSION',
        referenceId: commission.id,
        description: `Commission for Booking ${commission.bookingId}`,
        status: WalletTransactionStatus.COMPLETED,
      });
    }
  }

  async findAll(filters: CommissionQueryFilters) {
    const { page = 1, limit = 10, companyId, bookingId, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        include: {
          company: { select: { name: true, referenceCode: true } },
          booking: { select: { referenceCode: true, totalAmountUsd: true } },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMetrics() {
    const totalPendingAgg = await this.prisma.commission.aggregate({
      where: { status: CommissionStatus.PENDING },
      _sum: { amount: true },
    });

    const totalApprovedAgg = await this.prisma.commission.aggregate({
      where: { status: CommissionStatus.APPROVED },
      _sum: { amount: true },
    });

    const pendingCount = await this.prisma.commission.count({
      where: { status: CommissionStatus.PENDING },
    });

    return {
      totalPendingUsd: Number(totalPendingAgg._sum.amount || 0),
      totalApprovedUsd: Number(totalApprovedAgg._sum.amount || 0),
      pendingCount,
    };
  }
}
