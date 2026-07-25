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
    const commission = await this.prisma.commission.findUnique({
      where: { id },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    if (commission.status === data.status) return commission;

    const oldStatus = commission.status;
    const updated = await this.prisma.commission.update({
      where: { id },
      data: { status: data.status },
    });

    if (
      (data.status === CommissionStatus.APPROVED ||
        data.status === CommissionStatus.PAID) &&
      oldStatus === CommissionStatus.PENDING
    ) {
      await this.processCommissionApproval(id);
    } else if (
      data.status === CommissionStatus.CANCELLED &&
      (oldStatus === CommissionStatus.APPROVED ||
        oldStatus === CommissionStatus.PAID)
    ) {
      await this.processCommissionReversal(id);
    }

    return updated;
  }

  async processCommissionApproval(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (
      commission &&
      (commission.status === CommissionStatus.APPROVED ||
        commission.status === CommissionStatus.PAID)
    ) {
      // Check if wallet credit transaction already exists to ensure idempotency
      const existingTx = await this.prisma.walletTransaction.findFirst({
        where: {
          referenceType: 'COMMISSION',
          referenceId: commission.id,
          type: WalletTransactionType.CREDIT,
        },
      });

      if (!existingTx) {
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
  }

  async processCommissionReversal(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (commission && commission.status === CommissionStatus.CANCELLED) {
      // Check if reversal transaction already exists for idempotency
      const existingReversal = await this.prisma.walletTransaction.findFirst({
        where: {
          referenceType: 'COMMISSION_REVERSAL',
          referenceId: commission.id,
          type: WalletTransactionType.DEBIT,
        },
      });

      if (!existingReversal) {
        await this.walletsService.addTransaction({
          ownerType: WalletOwnerType.COMPANY,
          ownerId: commission.companyId,
          amount: Number(commission.amount),
          type: WalletTransactionType.DEBIT,
          referenceType: 'COMMISSION_REVERSAL',
          referenceId: commission.id,
          description: `Commission Reversal for Cancelled/Refunded Booking ${commission.bookingId}`,
          status: WalletTransactionStatus.COMPLETED,
        });
      }
    }
  }

  async createCommissionForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { company: true },
    });

    if (!booking || !booking.companyId || !booking.company) {
      return null;
    }

    const existing = await this.prisma.commission.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    const rate = booking.company.commissionRate;
    if (Number(rate) <= 0) return null;

    const amount = booking.totalAmountUsd.mul(rate).div(100);

    return this.prisma.commission.create({
      data: {
        companyId: booking.companyId,
        bookingId,
        rate,
        amount,
        status: CommissionStatus.PENDING,
      },
    });
  }

  async reverseCommissionForBooking(bookingId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { bookingId },
    });

    if (!commission) return null;

    return this.updateCommissionStatus(commission.id, {
      status: CommissionStatus.CANCELLED,
    });
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
