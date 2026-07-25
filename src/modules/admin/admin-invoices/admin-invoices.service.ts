import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
import { PaymentsService } from '../../payments/payments.service';

@Injectable()
export class AdminInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll(pageVal: number = 1, limitVal: number = 10, status?: string) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where = status ? { status: status as InvoiceStatus } : {};

    const [total, records] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { issuedAt: 'desc' },
        include: { booking: true, payment: true },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { booking: true, payment: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async voidInvoice(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOID },
    });
  }

  async refundInvoice(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.PAID || !invoice.paymentId) {
      throw new BadRequestException(
        'Cannot refund an unpaid invoice or invoice without payment',
      );
    }
    return this.paymentsService.refundPayment(invoice.paymentId);
  }
}
