import { Controller, Post, Body, HttpCode, HttpStatus, Req, RawBodyRequest, UseGuards, Param, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request as ExpressRequest } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async initiatePayment(@Body() dto: CreatePaymentDto) {
    const session = await this.paymentsService.initiatePayment(dto.bookingId);
    return { url: session.url, transactionId: session.transactionId };
  }

  @Post('webhook/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<ExpressRequest>,
  ) {
    // We pass the raw request and rawBody down. The specific adapter will 
    // handle signature verification (e.g. stripe-signature header)
    if (!req.rawBody) {
      throw new Error('Raw body is required for webhook signature verification');
    }
    
    // In a multi-provider setup, the provider param would dictate which gateway adapter to use.
    // Since we only have Stripe right now, PaymentsService uses the injected IPaymentGatewayPort directly.
    return this.paymentsService.handleWebhook(req, req.rawBody);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async refundPayment(
    @Param('id') id: string,
    @Body('amount') amount?: number,
  ) {
    return this.paymentsService.refundPayment(id, amount);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.paymentsService.getPaymentStatus(id, req.user.id);
  }
}
