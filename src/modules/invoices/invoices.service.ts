import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { extractI18n } from '../../common/utils';
import { InvoiceResponse, InvoiceBillingResponse } from './types';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByInvoiceNumber(invoiceNumber: string, userId?: string, email?: string): Promise<InvoiceResponse> {
    this.logger.debug(`Invoice queried | number=${invoiceNumber}`);

    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        booking: {
          include: {
            tour: { select: { titleJsonb: true, slug: true } },
            billingInfo: true,
          },
        },
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice not found | number=${invoiceNumber}`);
      throw new NotFoundException('Invoice not found');
    }

    const isOwner = userId && invoice.booking.userId === userId;
    const isEmailMatch = email && invoice.booking.billingInfo?.email === email;
    
    if (!isOwner && !isEmailMatch) {
      this.logger.warn(`Unauthorized access attempt to invoice | number=${invoiceNumber}`);
      throw new UnauthorizedException('You do not have permission to view this invoice');
    }

    if (!invoice.booking.billingInfo) {
      this.logger.error(
        `Invoice data integrity error — no billingInfo | invoiceId=${invoice.id}`,
      );
      throw new InternalServerErrorException('Invoice data is incomplete');
    }

    const billingInfo = invoice.booking.billingInfo;
    const billing: InvoiceBillingResponse = {
      fullName: billingInfo.fullName,
      email: billingInfo.email,
      phone: billingInfo.phone,
      invoiceType: billingInfo.invoiceType,
      companyName: billingInfo.companyName,
      taxId: billingInfo.taxId,
      address: billingInfo.address,
      city: billingInfo.city,
      country: billingInfo.country,
    };

    return {
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt.toISOString(),
      status: invoice.booking.status,
      tourTitle: extractI18n(invoice.booking.tour.titleJsonb, 'en'),
      tourSlug: invoice.booking.tour.slug,
      arrivalDate: invoice.booking.arrivalDate.toISOString().split('T')[0],
      departureDate: invoice.booking.departureDate
        ? invoice.booking.departureDate.toISOString().split('T')[0]
        : null,
      adults: invoice.booking.adults,
      children: invoice.booking.children,
      infants: invoice.booking.infants,
      totalAmountUsd: invoice.booking.totalAmountUsd.toString(),
      billing,
    };
  }
}
