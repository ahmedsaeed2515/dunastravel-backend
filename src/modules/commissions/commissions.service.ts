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
  BookingStatus,
  CompanyStatus,
  Prisma,
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
        select: {
          totalAmountUsd: true,
          companyId: true,
          status: true,
          deletedAt: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: data.companyId },
        select: {
          commissionRate: true,
          status: true,
          deletedAt: true,
        },
      }),
    ]);

    if (!booking) throw new BadRequestException('Booking not found');
    if (!company) throw new BadRequestException('Company not found');
    if (
      booking.deletedAt ||
      booking.companyId !== data.companyId ||
      !(
        [
          BookingStatus.CONFIRMED,
          BookingStatus.PAID,
          BookingStatus.COMPLETED,
        ] as BookingStatus[]
      ).includes(booking.status)
    ) {
      throw new BadRequestException(
        'The booking is not eligible for this company commission',
      );
    }
    if (
      company.deletedAt ||
      company.status !== CompanyStatus.ACTIVE ||
      company.commissionRate.lte(0)
    ) {
      throw new BadRequestException(
        'The company is not eligible to receive commissions',
      );
    }

    const expectedAmount = booking.totalAmountUsd
      .mul(company.commissionRate)
      .div(100)
      .toDecimalPlaces(2);
    const submittedAmount = new Prisma.Decimal(data.amount);
    const submittedRate = new Prisma.Decimal(data.rate);

    if (
      !submittedAmount.equals(expectedAmount) ||
      !submittedRate.equals(company.commissionRate)
    ) {
      this.logger.warn(
        `Rejected commission terms that did not match server-derived terms for bookingId=${data.bookingId}`,
      );
      throw new BadRequestException(
        'Commission terms do not match the server-calculated value',
      );
    }

    return this.prisma.commission.create({
      data: {
        companyId: data.companyId,
        bookingId: data.bookingId,
        rate: company.commissionRate,
        amount: expectedAmount,
        status: CommissionStatus.PENDING,
      },
    });
  }

  async updateCommissionStatus(id: string, data: UpdateCommissionStatusDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
    });
    if (!commission) throw new NotFoundException('Commission not found');

    // Step 1: Same-status → pure idempotent return, NO side effects
    if (commission.status === data.status) return commission;

    const oldStatus = commission.status;
    const allowedTransitions: Record<CommissionStatus, CommissionStatus[]> = {
      [CommissionStatus.PENDING]: [
        CommissionStatus.APPROVED,
        CommissionStatus.CANCELLED,
      ],
      [CommissionStatus.APPROVED]: [
        CommissionStatus.PAID,
        CommissionStatus.CANCELLED,
      ],
      [CommissionStatus.PAID]: [CommissionStatus.CANCELLED],
      [CommissionStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[oldStatus].includes(data.status)) {
      throw new BadRequestException(
        `Commission cannot transition from ${oldStatus} to ${data.status}`,
      );
    }

    // Step 2: Wrap status update + wallet operation in a SINGLE Prisma transaction
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.commission.update({
        where: { id },
        data: { status: data.status },
      });

      if (
        data.status === CommissionStatus.APPROVED ||
        data.status === CommissionStatus.PAID
      ) {
        await this.processCommissionApproval(id, tx);
      } else if (
        data.status === CommissionStatus.CANCELLED &&
        (oldStatus === CommissionStatus.APPROVED ||
          oldStatus === CommissionStatus.PAID)
      ) {
        await this.processCommissionReversal(id, tx);
      }

      return updated;
    });
  }

  async processCommissionApproval(
    commissionId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx ?? this.prisma;
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (
      commission &&
      (commission.status === CommissionStatus.APPROVED ||
        commission.status === CommissionStatus.PAID)
    ) {
      // Check if wallet credit transaction already exists to ensure idempotency.
      // Also skip re-crediting if a reversal DEBIT already exists (A -> CANCELLED -> re-APPROVED)
      // to avoid crediting the same commission twice.
      const [existingTx, existingReversal] = await Promise.all([
        prisma.walletTransaction.findFirst({
          where: {
            referenceType: 'COMMISSION',
            referenceId: commission.id,
            type: WalletTransactionType.CREDIT,
          },
        }),
        prisma.walletTransaction.findFirst({
          where: {
            referenceType: 'COMMISSION_REVERSAL',
            referenceId: commission.id,
            type: WalletTransactionType.DEBIT,
          },
        }),
      ]);

      if (!existingTx && !existingReversal) {
        await this.walletsService.addTransaction({
          ownerType: WalletOwnerType.COMPANY,
          ownerId: commission.companyId,
          amount: commission.amount.toDecimalPlaces(2).toNumber(),
          type: WalletTransactionType.CREDIT,
          referenceType: 'COMMISSION',
          referenceId: commission.id,
          description: `Commission for Booking ${commission.bookingId}`,
          status: WalletTransactionStatus.COMPLETED,
        });
      }
    }
  }

  async processCommissionReversal(
    commissionId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx ?? this.prisma;
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (commission && commission.status === CommissionStatus.CANCELLED) {
      // Only debit the wallet if the commission was previously credited
      // (APPROVED/PAID). Reversing a PENDING commission must NOT create a
      // DEBIT, otherwise the partner balance goes negative without reason.
      const wasCredited =
        (await prisma.walletTransaction.findFirst({
          where: {
            referenceType: 'COMMISSION',
            referenceId: commission.id,
            type: WalletTransactionType.CREDIT,
          },
        })) != null;

      // Check if reversal transaction already exists for idempotency
      const existingReversal = await prisma.walletTransaction.findFirst({
        where: {
          referenceType: 'COMMISSION_REVERSAL',
          referenceId: commission.id,
          type: WalletTransactionType.DEBIT,
        },
      });

      if (wasCredited && !existingReversal) {
        await this.walletsService.addTransaction({
          ownerType: WalletOwnerType.COMPANY,
          ownerId: commission.companyId,
          amount: commission.amount.toDecimalPlaces(2).toNumber(),
          type: WalletTransactionType.DEBIT,
          referenceType: 'COMMISSION_REVERSAL',
          referenceId: commission.id,
          description: `Commission Reversal for Cancelled/Refunded Booking ${commission.bookingId}`,
          status: WalletTransactionStatus.COMPLETED,
        });
      }
    }
  }

  async calculateAndRecordCommission(
    bookingId: string,
    companyId?: string,
    tx?: Prisma.TransactionClient | PrismaService,
  ) {
    const client = tx || this.prisma;
    const booking = await client.booking.findUnique({
      where: { id: bookingId },
      include: { company: true },
    });

    const targetCompanyId = booking?.companyId || companyId;
    if (!booking || !targetCompanyId) {
      return null;
    }

    const company =
      booking.company ||
      (await client.company.findUnique({
        where: { id: targetCompanyId },
      }));

    if (
      !company ||
      company.deletedAt ||
      company.status !== CompanyStatus.ACTIVE
    ) {
      return null;
    }

    const existing = await client.commission.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    const rate = company.commissionRate;
    if (Number(rate) <= 0) return null;

    const amount = booking.totalAmountUsd.mul(rate).div(100).toDecimalPlaces(2);

    return client.commission.create({
      data: {
        companyId: targetCompanyId,
        bookingId,
        rate,
        amount,
        status: CommissionStatus.PENDING,
      },
    });
  }

  async createCommissionForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { company: true },
    });

    if (!booking || !booking.companyId || !booking.company) {
      return null;
    }
    if (
      !(
        [
          BookingStatus.CONFIRMED,
          BookingStatus.PAID,
          BookingStatus.COMPLETED,
        ] as BookingStatus[]
      ).includes(booking.status) ||
      booking.deletedAt ||
      booking.company.deletedAt ||
      booking.company.status !== CompanyStatus.ACTIVE
    ) {
      return null;
    }

    const existing = await this.prisma.commission.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    const rate = booking.company.commissionRate;
    if (Number(rate) <= 0) return null;

    const amount = booking.totalAmountUsd.mul(rate).div(100).toDecimalPlaces(2);

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

  async adjustCommissionForPartialRefund(
    bookingId: string,
    totalRefunded: Prisma.Decimal,
    refundRecordId: string,
  ) {
    const commission = await this.prisma.commission.findUnique({
      where: { bookingId },
      include: { booking: { select: { totalAmountUsd: true } } },
    });
    if (!commission || commission.status === CommissionStatus.CANCELLED) {
      return commission;
    }

    const remainingRevenue = Prisma.Decimal.max(
      commission.booking.totalAmountUsd.minus(totalRefunded),
      new Prisma.Decimal(0),
    );
    const adjustedAmount = remainingRevenue
      .mul(commission.rate)
      .div(100)
      .toDecimalPlaces(2);
    const reduction = commission.amount.minus(adjustedAmount);
    if (reduction.lte(0)) return commission;

    if (
      commission.status === CommissionStatus.APPROVED ||
      commission.status === CommissionStatus.PAID
    ) {
      await this.walletsService.addTransaction({
        ownerType: WalletOwnerType.COMPANY,
        ownerId: commission.companyId,
        amount: reduction.toDecimalPlaces(2).toNumber(),
        type: WalletTransactionType.DEBIT,
        referenceType: 'COMMISSION_REVERSAL_PARTIAL',
        referenceId: refundRecordId,
        description: `Commission adjustment for partial refund on booking ${bookingId}`,
        status: WalletTransactionStatus.COMPLETED,
      });
    }

    return this.prisma.commission.update({
      where: { id: commission.id },
      data: {
        amount: adjustedAmount,
        ...(adjustedAmount.lte(0)
          ? { status: CommissionStatus.CANCELLED }
          : {}),
      },
    });
  }

  async findAll(filters: CommissionQueryFilters) {
    const {
      page = 1,
      limit = 10,
      companyId,
      bookingId,
      bookingReference,
      status,
    } = filters;
    const parsedLimit =
      Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 10;
    const skip = (page - 1) * parsedLimit;

    const where: Prisma.CommissionWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (bookingId) where.bookingId = bookingId;
    if (bookingReference?.trim()) {
      where.booking = {
        referenceCode: {
          contains: bookingReference.trim(),
          mode: 'insensitive',
        },
      };
    }
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        include: {
          company: { select: { name: true, referenceCode: true } },
          booking: {
            select: {
              referenceCode: true,
              totalAmountUsd: true,
              invoice: { select: { invoiceNumber: true } },
            },
          },
        },
        skip,
        take: parsedLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return {
      data: data.map(({ booking, ...commission }) => ({
        ...commission,
        booking: {
          referenceCode: booking?.referenceCode ?? '—',
          totalAmountUsd: booking?.totalAmountUsd ?? 0,
          invoiceNumber: booking?.invoice?.invoiceNumber ?? null,
        },
      })),
      meta: {
        total,
        page,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    };
  }

  async getMetrics() {
    const totalPendingAgg = await this.prisma.commission.aggregate({
      where: { status: CommissionStatus.PENDING },
      _sum: { amount: true },
    });

    const totalApprovedAgg = await this.prisma.commission.aggregate({
      where: {
        status: { in: [CommissionStatus.APPROVED, CommissionStatus.PAID] },
      },
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
