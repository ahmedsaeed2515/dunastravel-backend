import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { paginate, getPaginationParams, extractI18n } from '../../../common/utils';
import { PaymentsService } from '../../payments/payments.service';
import { AuthenticatedUser } from '../../../common/types';
import { RefundPaymentDto } from '../../payments/dto/refund-payment.dto';

@Injectable()
export class AdminInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(
    pageVal: number = 1,
    limitVal: number = 10,
    status?: InvoiceStatus,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where = status ? { status } : {};

    const [total, records] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              referenceCode: true,
              status: true,
              totalAmountUsd: true,
              paidAmountUsd: true,
              createdAt: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              isRefund: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(idOrRef: string) {
    let invoice = (await this.prisma.invoice.findFirst({
      where: {
        OR: [
          { id: idOrRef },
          { invoiceNumber: idOrRef },
          { bookingId: idOrRef },
          { booking: { referenceCode: idOrRef } },
        ],
      },
      include: {
        booking: {
          include: {
            tour: {
              select: {
                titleJsonb: true,
                slug: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                customerNumber: true,
              },
            },
            billingInfo: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            isRefund: true,
            createdAt: true,
          },
        },
      },
    })) as any;

    if (!invoice) {
      // Check if booking exists by ID or referenceCode
      const booking = (await this.prisma.booking.findFirst({
        where: {
          OR: [{ id: idOrRef }, { referenceCode: idOrRef }],
          deletedAt: null,
        },
        include: {
          tour: {
            select: {
              titleJsonb: true,
              slug: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              customerNumber: true,
            },
          },
          billingInfo: true,
          payments: {
            where: { isRefund: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })) as any;

      if (!booking) {
        throw new NotFoundException(`Invoice or booking '${idOrRef}' not found`);
      }

      // Generate invoice on-the-fly for legacy/unseeded booking
      const currentYear = new Date().getFullYear();
      const count = await this.prisma.invoice.count();
      const invoiceNumber = `INV-${currentYear}-${(count + 1).toString().padStart(4, '0')}`;
      const totalDec = new Prisma.Decimal(booking.totalAmountUsd);
      const subtotalVal = totalDec.toFixed(2);
      const taxVal = '0.00';
      const totalAmount = totalDec.toNumber();

      const recipientName = booking.billingInfo?.fullName || booking.user?.name || 'Valued Guest';
      const recipientEmail = booking.billingInfo?.email || booking.user?.email || 'guest@dunastravel.com';

      const snapshot = {
        version: 1,
        tourTitle: extractI18n(booking.tour?.titleJsonb, 'en') || 'Exclusive Luxury Tour',
        tourSlug: booking.tour?.slug || 'luxury-tour',
        arrivalDate: booking.arrivalDate.toISOString().split('T')[0],
        departureDate: booking.departureDate ? booking.departureDate.toISOString().split('T')[0] : null,
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        baseSubtotal: subtotalVal,
        tax: taxVal,
        total: totalAmount.toFixed(2),
        currency: 'USD',
        billingRecipient: {
          fullName: recipientName,
          email: recipientEmail,
          phone: booking.billingInfo?.phone || booking.user?.phone || '—',
          invoiceType: booking.billingInfo?.invoiceType || 'PERSONAL',
          companyName: booking.billingInfo?.companyName || null,
          taxId: booking.billingInfo?.taxId || null,
          address: booking.billingInfo?.address || null,
          city: booking.billingInfo?.city || null,
          country: booking.billingInfo?.country || null,
        },
      };

      const isPaid = booking.status === 'CONFIRMED' || Number(booking.paidAmountUsd) >= totalAmount;

      invoice = (await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId: booking.id,
          issuedAt: booking.createdAt,
          status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.SENT,
          subtotal: new Prisma.Decimal(subtotalVal),
          tax: new Prisma.Decimal(taxVal),
          total: new Prisma.Decimal(totalAmount.toFixed(2)),
          currency: 'USD',
          paymentId: booking.payments[0]?.id || null,
          snapshotJsonb: snapshot as unknown as Prisma.InputJsonValue,
        },
        include: {
          booking: {
            include: {
              tour: {
                select: {
                  titleJsonb: true,
                  slug: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  customerNumber: true,
                },
              },
              billingInfo: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              method: true,
              status: true,
              isRefund: true,
              createdAt: true,
            },
          },
        },
      })) as any;
    }

    return invoice;
  }

  async voidInvoice(id: string, actor: AuthenticatedUser) {
    const invoice = await this.findOne(id);
    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.SENT
    ) {
      throw new BadRequestException(
        'Only draft or sent invoices can be voided',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({
        where: { id, status: invoice.status },
        data: { status: InvoiceStatus.VOID },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Invoice was modified concurrently');
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'INVOICE_VOIDED',
          entityType: 'Invoice',
          entityId: id,
          metadata: { previousStatus: invoice.status },
        },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });
  }

  async refundInvoice(
    id: string,
    dto: RefundPaymentDto,
    actor: AuthenticatedUser,
  ) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.PAID || !invoice.paymentId) {
      throw new BadRequestException(
        'Cannot refund an unpaid invoice or invoice without payment',
      );
    }
    return this.paymentsService.refundPayment(
      invoice.paymentId,
      dto.amount,
      dto.reason,
      dto.idempotencyKey,
      actor,
    );
  }
}
