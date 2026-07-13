import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { Request } from 'express';
import { IPaymentGatewayPort, CheckoutSessionData, WebhookPayload } from '../interfaces/payment-gateway.port';

@Injectable()
export class StripeAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(StripeAdapter.name);
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey || stripeSecretKey.includes('your_key') || stripeSecretKey === 'sk_live_your_key_here') {
      this.logger.warn('STRIPE_SECRET_KEY is missing or is a placeholder — Stripe payments will be unavailable. Set the real key in Vercel Environment Variables.');
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-01-27.acacia' as any,
      });
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment variables.');
    }
    return this.stripe;
  }

  getProviderName(): string {
    return 'STRIPE';
  }

  async createSession(bookingId: string, amountUsd: number, currency: string, referenceCode: string): Promise<CheckoutSessionData> {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Booking Ref: ${referenceCode}`,
            },
            unit_amount: Math.round(amountUsd * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/booking/cancel`,
      client_reference_id: bookingId,
      metadata: { bookingId },
    });

    if (!session.url) {
      throw new Error('Failed to create Stripe checkout session URL');
    }

    return { url: session.url, transactionId: session.id };
  }

  async verifyAndParseWebhook(req: Request, rawBody: Buffer): Promise<WebhookPayload> {
    const stripe = this.requireStripe();
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is missing in environment variables');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        eventId: event.id,
        paymentId: session.id,
        bookingId: session.client_reference_id || session.metadata?.bookingId || '',
        amountUsd: (session.amount_total || 0) / 100,
        status: 'COMPLETED',
        rawEvent: event,
      };
    }

    const obj = event.data.object as any;
    const fallbackBookingId = obj?.client_reference_id || obj?.metadata?.bookingId || '';
    return { eventId: event.id, paymentId: '', bookingId: fallbackBookingId, amountUsd: 0, status: 'PENDING', rawEvent: event };
  }

  async refund(transactionId: string, amount?: number): Promise<{ refundId: string }> {
    const stripe = this.requireStripe();
    try {
      const session = await stripe.checkout.sessions.retrieve(transactionId);
      if (!session.payment_intent) {
        throw new Error('No payment intent associated with this session');
      }

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: session.payment_intent as string,
      };
      if (amount) refundParams.amount = Math.round(amount * 100);

      const refund = await stripe.refunds.create(refundParams);
      return { refundId: refund.id };
    } catch (err: any) {
      this.logger.error(`Stripe refund failed: ${err.message}`);
      throw new BadRequestException(`Refund failed: ${err.message}`);
    }
  }

  async expireSession(sessionId: string): Promise<void> {
    const stripe = this.requireStripe();
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(sessionId);
        this.logger.log(`Expired Stripe session: ${sessionId}`);
      } else {
        this.logger.log(`Stripe session ${sessionId} is not open (status: ${session.status}), skipping.`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to expire Stripe session ${sessionId}: ${err.message}`);
    }
  }
}
