import { BadRequestException } from '@nestjs/common';

export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string,
  ) {
    if (!Number.isInteger(_amount)) {
      throw new BadRequestException('Money amount must be an integer (in cents/smallest currency unit)');
    }
    this._currency = _currency.toUpperCase();
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  /**
   * Creates a Money instance from the smallest currency unit (e.g., cents)
   */
  static fromCents(amount: number, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }

  /**
   * Creates a Money instance from a decimal value (e.g., dollars)
   */
  static fromDecimal(amount: number | string, currency: string = 'USD'): Money {
    const decimalAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Money(Math.round(decimalAmount * 100), currency);
  }

  toDecimal(): number {
    return this._amount / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new BadRequestException(`Currency mismatch: ${this._currency} vs ${other._currency}`);
    }
  }

  toString(): string {
    return `${this.toDecimal().toFixed(2)} ${this._currency}`;
  }
}
