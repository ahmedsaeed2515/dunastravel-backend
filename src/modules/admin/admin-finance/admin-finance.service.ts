import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminFinanceQueryDto } from './dto/admin-finance-query.dto';
import { AdminRefundDto } from './dto/admin-refund.dto';
import { PaymentsService } from '../../payments/payments.service';
import { paginate, getPaginationParams } from '../../../common/utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminFinanceService {
  private readonly logger = new Logger(AdminFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async listPayments(query: AdminFinanceQueryDto) {
    const { skip, take, page, limit } = getPaginationParams(
      query.page ?? 1,
      query.limit ?? 10,
    );

    const where: Prisma.PaymentWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.method) {
      where.method = query.method;
    }
    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim().length > 0) {
      const searchStr = query.search.trim();
      where.OR = [
        { transactionId: { contains: searchStr, mode: 'insensitive' } },
        { merchantReference: { contains: searchStr, mode: 'insensitive' } },
        { providerPaymentId: { contains: searchStr, mode: 'insensitive' } },
        {
          booking: {
            referenceCode: { contains: searchStr, mode: 'insensitive' },
          },
        },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy: Prisma.PaymentOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    try {
      const [total, items] = await Promise.all([
        this.prisma.payment.count({ where }),
        this.prisma.payment.findMany({
          where,
          skip,
          take,
          orderBy,
          include: {
            booking: {
              select: {
                id: true,
                referenceCode: true,
                userId: true,
                status: true,
                totalAmountUsd: true,
                paidAmountUsd: true,
                billingInfo: { select: { fullName: true, email: true } },
                invoice: { select: { invoiceNumber: true } },
              },
            },
            invoices: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
              },
            },
            refunds: {
              select: {
                id: true,
                idempotencyKey: true,
                amount: true,
                currency: true,
                providerRefundId: true,
                status: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        }),
      ]);

      const formattedItems = items.map((item) => {
        const bkg = item.booking;
        const amountStr =
          item.amount != null ? Number(item.amount).toFixed(2) : '0.00';
        const bkgTotalStr =
          bkg?.totalAmountUsd != null
            ? Number(bkg.totalAmountUsd).toFixed(2)
            : '0.00';
        const bkgPaidStr =
          bkg?.paidAmountUsd != null
            ? Number(bkg.paidAmountUsd).toFixed(2)
            : '0.00';

        const completedRefunds = (item.refunds || []).filter(
          (r) => r.status === 'COMPLETED',
        );
        const refundedAmountStr = completedRefunds
          .reduce((acc, r) => acc.plus(r.amount || 0), new Prisma.Decimal(0))
          .toFixed(2);

        return {
          id: item.id,
          bookingId: item.bookingId,
          bookingReferenceCode: bkg?.referenceCode ?? '—',
          amount: amountStr,
          currency: item.currency || 'USD',
          provider: item.provider ?? item.method ?? 'GetPayIn',
          providerEnvironment: item.providerEnvironment,
          merchantReference: item.merchantReference,
          providerPaymentId: item.providerPaymentId,
          providerStatus: item.providerStatus,
          providerAuthCode: item.providerAuthCode,
          lastProviderCheckAt: item.lastProviderCheckAt,
          checkoutExpiresAt: item.expiresAt,
          attemptNumber: item.attemptNumber,
          method: item.method,
          transactionId: item.transactionId,
          status: item.status,
          isRefund: item.isRefund,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          paidAt: item.paidAt,
          failedAt: item.failedAt,
          cancelledAt: item.cancelledAt,
          refundedAt: item.refundedAt,
          failureCode: item.failureCode,
          failureMessage: item.failureMessage,
          bookingStatus: bkg?.status ?? 'UNKNOWN',
          customerName: bkg?.billingInfo?.fullName ?? null,
          customerEmail: bkg?.billingInfo?.email ?? null,
          invoiceNumber:
            item.invoices?.[0]?.invoiceNumber ??
            bkg?.invoice?.invoiceNumber ??
            null,
          refundedAmount: refundedAmountStr,
          bookingTotalAmountUsd: bkgTotalStr,
          bookingPaidAmountUsd: bkgPaidStr,
          invoices: item.invoices || [],
          refunds: (item.refunds || []).map((r) => ({
            ...r,
            amount: r.amount != null ? Number(r.amount).toFixed(2) : '0.00',
          })),
        };
      });

      return paginate(formattedItems, total, page, limit);
    } catch (err: any) {
      this.logger.error(`Error in listPayments: ${err?.message}`, err?.stack);
      throw err;
    }
  }

  async getPaymentDetail(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            billingInfo: true,
            passengers: true,
            invoice: true,
          },
        },
        invoices: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const bkg = payment.booking;

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount:
        payment.amount != null ? Number(payment.amount).toFixed(2) : '0.00',
      currency: payment.currency || 'USD',
      provider: payment.provider ?? payment.method ?? 'GetPayIn',
      providerEnvironment: payment.providerEnvironment,
      merchantReference: payment.merchantReference,
      providerPaymentId: payment.providerPaymentId,
      attemptNumber: payment.attemptNumber,
      method: payment.method,
      transactionId: payment.transactionId,
      status: payment.status,
      isRefund: payment.isRefund,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      cancelledAt: payment.cancelledAt,
      refundedAt: payment.refundedAt,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      booking: bkg
        ? {
            id: bkg.id,
            referenceCode: bkg.referenceCode,
            status: bkg.status,
            totalAmountUsd:
              bkg.totalAmountUsd != null
                ? Number(bkg.totalAmountUsd).toFixed(2)
                : '0.00',
            paidAmountUsd:
              bkg.paidAmountUsd != null
                ? Number(bkg.paidAmountUsd).toFixed(2)
                : '0.00',
            arrivalDate: bkg.arrivalDate,
            billingInfo: bkg.billingInfo,
            passengersCount: bkg.passengers?.length ?? 0,
          }
        : null,
      invoices: (payment.invoices || []).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        subtotal:
          inv.subtotal != null ? Number(inv.subtotal).toFixed(2) : '0.00',
        total: inv.total != null ? Number(inv.total).toFixed(2) : '0.00',
        currency: inv.currency,
      })),
      refunds: (payment.refunds || []).map((r) => ({
        id: r.id,
        idempotencyKey: r.idempotencyKey,
        amount: r.amount != null ? Number(r.amount).toFixed(2) : '0.00',
        currency: r.currency,
        providerRefundId: r.providerRefundId,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  }

  async getReconciliationSummary() {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    const [
      statusGroups,
      stalePendingCount,
      pendingRefundCount,
      missingReferenceCount,
    ] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { isRefund: false },
        _count: { _all: true },
      }),
      this.prisma.payment.count({
        where: {
          isRefund: false,
          status: { in: ['PENDING', 'AUTHORIZED'] },
          createdAt: { lt: staleBefore },
        },
      }),
      this.prisma.refundRecord.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({
        where: {
          isRefund: false,
          provider: 'GETPAYIN',
          OR: [
            { merchantReference: null },
            { providerPaymentId: null },
            { transactionId: null },
          ],
        },
      }),
    ]);

    return {
      statusCounts: Object.fromEntries(
        statusGroups.map((group) => [group.status, group._count._all]),
      ),
      stalePendingCount,
      pendingRefundCount,
      missingReferenceCount,
      generatedAt: new Date().toISOString(),
    };
  }

  async processRefund(
    _dto: AdminRefundDto,
    _actor?: { id: string; role: string },
  ) {
    throw new BadRequestException(
      'Online refunds are disabled. All refunds are processed offline directly by company finance.',
    );
  }
}
