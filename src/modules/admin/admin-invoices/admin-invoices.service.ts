import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
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

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
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
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
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
