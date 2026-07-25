import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminFinanceQueryDto } from './dto/admin-finance-query.dto';
import { AdminRefundDto } from './dto/admin-refund.dto';
import { PaymentsService } from '../../payments/payments.service';
import { paginate, getPaginationParams } from '../../../common/utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminFinanceService {
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
        { bookingId: { contains: searchStr, mode: 'insensitive' } },
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

    const [total, items] = await this.prisma.$transaction([
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

    const formattedItems = items.map((item) => ({
      id: item.id,
      bookingId: item.bookingId,
      bookingReferenceCode: item.booking.referenceCode,
      amount: item.amount.toFixed(2),
      currency: item.currency,
      method: item.method,
      transactionId: item.transactionId,
      status: item.status,
      isRefund: item.isRefund,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      bookingStatus: item.booking.status,
      bookingTotalAmountUsd: item.booking.totalAmountUsd.toFixed(2),
      bookingPaidAmountUsd: item.booking.paidAmountUsd.toFixed(2),
      invoices: item.invoices,
      refunds: item.refunds.map((r) => ({
        ...r,
        amount: r.amount.toFixed(2),
      })),
    }));

    return paginate(formattedItems, total, page, limit);
  }

  async getPaymentDetail(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            billingInfo: true,
            passengers: true,
          },
        },
        invoices: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      method: payment.method,
      transactionId: payment.transactionId,
      status: payment.status,
      isRefund: payment.isRefund,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      booking: {
        id: payment.booking.id,
        referenceCode: payment.booking.referenceCode,
        status: payment.booking.status,
        totalAmountUsd: payment.booking.totalAmountUsd.toFixed(2),
        paidAmountUsd: payment.booking.paidAmountUsd.toFixed(2),
        arrivalDate: payment.booking.arrivalDate,
        billingInfo: payment.booking.billingInfo,
        passengersCount: payment.booking.passengers.length,
      },
      invoices: payment.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        subtotal: inv.subtotal.toFixed(2),
        total: inv.total.toFixed(2),
        currency: inv.currency,
      })),
      refunds: payment.refunds.map((r) => ({
        id: r.id,
        idempotencyKey: r.idempotencyKey,
        amount: r.amount.toFixed(2),
        currency: r.currency,
        providerRefundId: r.providerRefundId,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  }

  async processRefund(
    dto: AdminRefundDto,
    actor?: { id: string; role: string },
  ) {
    return this.paymentsService.refundPayment(
      dto.paymentId,
      dto.amount,
      dto.reason,
      dto.idempotencyKey,
      actor,
    );
  }
}
