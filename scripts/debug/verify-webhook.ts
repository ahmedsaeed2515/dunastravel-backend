import axios from 'axios';
import { PrismaClient } from '@prisma/client';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const BASE_URL = 'http://localhost:5000/api';
import Stripe = require('stripe');
const stripe = new Stripe('sk_test_placeholder', { apiVersion: '2025-01-27.acacia' as any });

async function verify() {
  try {
    console.log('--- Setting up data ---');
    const user = await prisma.user.create({
      data: { email: `verify-${Date.now()}@example.com`, passwordHash: 'dummy', name: 'Verify', role: 'USER' },
    });
    const tour = await prisma.tour.create({
      data: { titleJsonb: { en: 'Verify Tour' }, slug: `verify-tour-${Date.now()}`, basePriceUsd: 100, capacity: 10, remainingSeats: 10 },
    });
    const booking = await prisma.booking.create({
      data: {
        userId: user.id, tourId: tour.id, arrivalDate: new Date(), adults: 1, children: 0,
        status: 'PENDING', totalAmountUsd: 100, referenceCode: `VRF-${Date.now()}`
      }
    });

    console.log(`Created Booking: ${booking.id}`);
    const eventId = `evt_${Date.now()}`;
    const payload = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${Date.now()}`,
          client_reference_id: booking.id,
          amount_total: 10000,
          payment_intent: `pi_test_${Date.now()}`,
          currency: 'usd',
        }
      }
    };

    console.log('--- Firing Concurrent Requests ---');
    
    // We will hit the webhook controller
    // Wait, the webhook controller in test is at /payments/webhook
    const webhookUrl = `${BASE_URL}/payments/webhook/stripe`;
    
    const payloadString = JSON.stringify(payload);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: 'whsec_placeholder',
    });

    console.log('Sending two identical requests concurrently...');
    const results = await Promise.allSettled([
      axios.post(webhookUrl, payload, { headers: { 'stripe-signature': signature, 'x-csrf-token': 'dummy', 'cookie': 'csrf_token=dummy' }, validateStatus: () => true }),
      axios.post(webhookUrl, payload, { headers: { 'stripe-signature': signature, 'x-csrf-token': 'dummy', 'cookie': 'csrf_token=dummy' }, validateStatus: () => true })
    ]);

    const res1 = results[0].status === 'fulfilled' ? (results[0] as any).value : null;
    const res2 = results[1].status === 'fulfilled' ? (results[1] as any).value : null;

    console.log(`Req 1: ${res1?.status} ${JSON.stringify(res1?.data)}`);
    console.log(`Req 2: ${res2?.status} ${JSON.stringify(res2?.data)}`);

    // We can also check the Prisma error in the server logs if possible, 
    // but the API response should show a 409 Conflict or 200 OK
    // One should succeed, one should gracefully ignore (or throw conflict depending on idempotency design).
    // Our idempotency design returns 200 immediately if it's already processed.
    
    console.log('--- Verifying Database State ---');
    const processed = await prisma.processedWebhookEvent.findMany({ where: { id: eventId } });
    console.log(`Processed events in DB: ${processed.length}`);

    const payments = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    console.log(`Payments created: ${payments.length}`);

    console.log('--- Verifying Currency Guard ---');
      const badCurrencyPayload = {
        id: `evt_${Date.now()}_bad`,
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: paymentIntentId,
            amount_refunded: 50000,
            currency: 'eur',
          }
        }
      };
    const badPayloadString = JSON.stringify(badCurrencyPayload);
    const badSignature = stripe.webhooks.generateTestHeaderString({
      payload: badPayloadString,
      secret: 'whsec_placeholder',
    });
    const badRes = await axios.post(webhookUrl, badCurrencyPayload, { headers: { 'stripe-signature': badSignature, 'x-csrf-token': 'dummy', 'cookie': 'csrf_token=dummy' }, validateStatus: () => true });
    console.log(`Currency Guard response: ${badRes.status} ${JSON.stringify(badRes.data)}`);

    console.log('--- Verifying Missing Event ID Rejection ---');
    const missingIdPayload = {
      type: 'checkout.session.completed',
      data: payload.data
    };
    const missingIdString = JSON.stringify(missingIdPayload);
    const missingIdSignature = stripe.webhooks.generateTestHeaderString({
      payload: missingIdString,
      secret: 'whsec_placeholder',
    });
    const missingRes = await axios.post(webhookUrl, missingIdPayload, { headers: { 'stripe-signature': missingIdSignature, 'x-csrf-token': 'dummy', 'cookie': 'csrf_token=dummy' }, validateStatus: () => true });
    console.log(`Missing Event ID response: ${missingRes.status} (Expected 200 to prevent Stripe retry storm)`);

    console.log('--- Verifying Unhandled Event Booking ID ---');
    const unhandledPayload = {
      id: `evt_${Date.now()}_unhandled`,
      type: 'payment_intent.created',
      data: payload.data
    };
    const unhandledString = JSON.stringify(unhandledPayload);
    const unhandledSignature = stripe.webhooks.generateTestHeaderString({
      payload: unhandledString,
      secret: 'whsec_placeholder',
    });
    const unhandledRes = await axios.post(webhookUrl, unhandledPayload, { headers: { 'stripe-signature': unhandledSignature, 'x-csrf-token': 'dummy', 'cookie': 'csrf_token=dummy' }, validateStatus: () => true });
    console.log(`Unhandled Event response: ${unhandledRes.status} ${JSON.stringify(unhandledRes.data)}`);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
