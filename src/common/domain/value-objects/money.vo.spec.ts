import { Money } from './money.vo';
import { BadRequestException } from '@nestjs/common';

describe('Money Value Object', () => {
  it('should construct correctly', () => {
    const money = Money.fromCents(1000, 'USD');
    expect(money.amount).toBe(1000);
    expect(money.currency).toBe('USD');
  });

  it('should initialize from decimal', () => {
    const money = Money.fromDecimal(10.5, 'USD');
    expect(money.amount).toBe(1050);
  });

  it('should add correctly', () => {
    const m1 = Money.fromCents(1000, 'USD');
    const m2 = Money.fromCents(500, 'USD');
    const result = m1.add(m2);
    expect(result.amount).toBe(1500);
  });

  it('should subtract correctly', () => {
    const m1 = Money.fromCents(1000, 'USD');
    const m2 = Money.fromCents(500, 'USD');
    const result = m1.subtract(m2);
    expect(result.amount).toBe(500);
  });

  it('should throw BadRequestException when adding different currencies', () => {
    const m1 = Money.fromCents(1000, 'USD');
    const m2 = Money.fromCents(500, 'EUR');
    expect(() => m1.add(m2)).toThrow(BadRequestException);
  });
});
