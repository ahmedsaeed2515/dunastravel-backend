import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceResponse, InvoiceSnapshot } from './types';
import * as crypto from 'crypto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByInvoiceNumber(
    invoiceNumber: string,
    userId?: string,
    guestToken?: string,
  ): Promise<InvoiceResponse> {
    this.logger.debug(`Invoice queried | number=${invoiceNumber}`);

    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        booking: {
          select: {
            id: true,
            userId: true,
            guestTokenHash: true,
          },
        },
      },
    });

    if (!invoice) {
      this.logger.warn(`Invoice not found | number=${invoiceNumber}`);
      throw new NotFoundException('Invoice not found');
    }

    let isAuthorized = false;

    if (userId && invoice.booking.userId === userId) {
      isAuthorized = true;
    } else if (guestToken && invoice.booking.guestTokenHash) {
      const computedHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      const hashBufferA = Buffer.from(computedHash, 'utf8');
      const hashBufferB = Buffer.from(invoice.booking.guestTokenHash, 'utf8');
      if (
        hashBufferA.length === hashBufferB.length &&
        crypto.timingSafeEqual(hashBufferA, hashBufferB)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      this.logger.warn(
        `Unauthorized access attempt to invoice | number=${invoiceNumber}`,
      );
      throw new NotFoundException('Invoice not found');
    }

    if (!invoice.snapshotJsonb) {
      this.logger.error(
        `Invoice data integrity error — missing snapshot | invoiceId=${invoice.id}`,
      );
      throw new UnprocessableEntityException(
        'Invoice snapshot is missing or corrupted',
      );
    }

    const snap = invoice.snapshotJsonb as unknown as InvoiceSnapshot;

    if (!snap.billingRecipient || !snap.tourTitle) {
      throw new UnprocessableEntityException(
        'Invoice snapshot is missing required business fields',
      );
    }

    return {
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId,
      issuedAt: invoice.issuedAt.toISOString(),
      status: invoice.status,
      subtotal: invoice.subtotal.toString(),
      tax: invoice.tax.toString(),
      total: invoice.total.toString(),
      totalAmountUsd: invoice.total.toString(),
      currency: invoice.currency || snap.currency || 'USD',
      tourTitle: snap.tourTitle,
      tourSlug: snap.tourSlug || 'custom-tour',
      arrivalDate: snap.arrivalDate,
      departureDate: snap.departureDate || null,
      adults: snap.adults ?? 1,
      children: snap.children ?? 0,
      infants: snap.infants ?? 0,
      snapshot: snap,
      billing: snap.billingRecipient,
    };
  }
}
