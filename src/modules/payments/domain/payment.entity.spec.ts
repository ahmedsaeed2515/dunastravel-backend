import { PaymentEntity, InvalidPaymentTransitionException } from './payment.entity';
import { Money } from '../../../common/domain/value-objects/money.vo';
import { PaymentStatus } from '@prisma/client';

describe('PaymentEntity', () => {
  let payment: PaymentEntity;

  beforeEach(() => {
    payment = new PaymentEntity(
      'id-123',
      'booking-123',
      Money.fromCents(10000, 'USD'),
      'STRIPE',
      'txn-123',
      PaymentStatus.PENDING,
      new Date(),
    );
  });

  it('should allow PENDING to AUTHORIZED', () => {
    payment.markAuthorized();
    expect(payment.status).toBe(PaymentStatus.AUTHORIZED);
  });

  it('should allow PENDING to CAPTURED', () => {
    payment.markCaptured();
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
  });

  it('should allow AUTHORIZED to CAPTURED', () => {
    payment.markAuthorized();
    payment.markCaptured();
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
  });

  it('should allow PENDING to FAILED', () => {
    payment.markFailed();
    expect(payment.status).toBe(PaymentStatus.FAILED);
  });

  it('should allow CAPTURED to REFUNDED', () => {
    payment.markCaptured();
    payment.markRefunded(Money.fromCents(10000, 'USD'));
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('should allow refund on non-USD payments with matching currency', () => {
    const eurPayment = new PaymentEntity(
      'id-eur',
      'booking-eur',
      Money.fromCents(5000, 'EUR'),
      'STRIPE',
      'txn-eur',
      PaymentStatus.CAPTURED,
      new Date(),
    );
    eurPayment.markRefunded(Money.fromCents(5000, 'EUR'));
    expect(eurPayment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('should throw when refund exceeds captured amount', () => {
    payment.markCaptured();
    expect(() => payment.markRefunded(Money.fromCents(15000, 'USD'))).toThrow('Refund amount cannot exceed captured amount');
  });

  it('should throw when refund currency does not match', () => {
    payment.markCaptured();
    expect(() => payment.markRefunded(Money.fromCents(10000, 'EUR'))).toThrow('Refund currency EUR does not match payment currency USD');
  });

  it('should throw on invalid transition PENDING to REFUNDED', () => {
    expect(() => payment.markRefunded(Money.fromCents(10000, 'USD'))).toThrow(InvalidPaymentTransitionException);
  });

  it('should allow PENDING to EXPIRED', () => {
    payment.expire();
    expect(payment.status).toBe(PaymentStatus.EXPIRED);
  });

  it('should throw on invalid transition AUTHORIZED to EXPIRED', () => {
    payment.markAuthorized();
    expect(() => payment.expire()).toThrow(InvalidPaymentTransitionException);
  });
});
