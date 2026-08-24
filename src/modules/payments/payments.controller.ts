import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
  UseGuards,
  Param,
  Get,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request as ExpressRequest } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Controller(['payments', 'admin/payments'])
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('readiness')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  getReadiness() {
    return this.paymentsService.getReadiness();
  }

  @Post(['initiate', 'checkout-session'])
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async initiatePayment(
    @Body() dto: CreatePaymentDto,
    @Req() req: ExpressRequest & { user?: { id: string } },
  ) {
    const rawGuestToken = req.headers['x-guest-token'];
    const guestToken =
      typeof rawGuestToken === 'string'
        ? rawGuestToken
        : Array.isArray(rawGuestToken)
          ? rawGuestToken[0]
          : undefined;

    const session = await this.paymentsService.initiatePayment(
      dto.bookingId,
      req.user?.id,
      guestToken,
    );
    return {
      sessionUrl: session.url,
      url: session.url,
      transactionId: session.transactionId,
      paymentId: session.paymentId,
    };
  }

  @Post('webhook/:provider')
  @Public()
  @SkipCsrf()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<ExpressRequest>,
  ) {
    if (!provider) {
      throw new BadRequestException('Payment provider is required');
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw body is required for webhook signature verification',
      );
    }

    return this.paymentsService.handleWebhook(provider, req, req.rawBody);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: ExpressRequest & { user: { id: string; role: string } },
  ) {
    return this.paymentsService.refundPayment(
      id,
      dto.amount,
      dto.reason,
      dto.idempotencyKey,
      req.user,
    );
  }

  @Get(':id/status')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async getPaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: ExpressRequest & { user?: { id: string } },
  ) {
    const rawGuestToken = req.headers['x-guest-token'];
    const guestToken =
      typeof rawGuestToken === 'string'
        ? rawGuestToken
        : Array.isArray(rawGuestToken)
          ? rawGuestToken[0]
          : undefined;
    return this.paymentsService.getPaymentStatus(id, req.user?.id, guestToken);
  }
}
