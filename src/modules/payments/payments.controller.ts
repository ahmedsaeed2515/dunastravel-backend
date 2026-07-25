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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request as ExpressRequest } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
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
    };
  }

  @Post('webhook/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<ExpressRequest>,
  ) {
    if (!provider || provider.toUpperCase() !== 'STRIPE') {
      throw new BadRequestException(
        `Unsupported payment provider: ${provider}`,
      );
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw body is required for webhook signature verification',
      );
    }

    return this.paymentsService.handleWebhook(req, req.rawBody);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async refundPayment(
    @Param('id') id: string,
    @Body()
    dto: { amount?: number; reason?: string; idempotencyKey?: string },
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
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.paymentsService.getPaymentStatus(id, req.user.id);
  }
}
