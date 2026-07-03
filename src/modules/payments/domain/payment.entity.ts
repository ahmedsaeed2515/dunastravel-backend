import { BadRequestException } from '@nestjs/common';
import { Money } from '../../../common/domain/value-objects/money.vo';
import { PaymentStatus } from '@prisma/client';

export class InvalidPaymentTransitionException extends BadRequestException {
  constructor(fromStatus: PaymentStatus, toStatus: PaymentStatus) {
    super(`Invalid payment state transition from ${fromStatus} to ${toStatus}`);
  }
}

export class PaymentEntity {
  private _status: PaymentStatus;

  constructor(
    public readonly id: string,
    public readonly bookingId: string,
    public readonly money: Money,
    public readonly method: string,
    public readonly transactionId: string | null,
    status: PaymentStatus,
    public readonly createdAt: Date,
  ) {
    this._status = status;
  }

  get status(): PaymentStatus {
    return this._status;
  }

  markAuthorized(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentTransitionException(this._status, PaymentStatus.AUTHORIZED);
    }
    this._status = PaymentStatus.AUTHORIZED;
  }

  markCaptured(): void {
    if (this._status !== PaymentStatus.PENDING && this._status !== PaymentStatus.AUTHORIZED) {
      throw new InvalidPaymentTransitionException(this._status, PaymentStatus.CAPTURED);
    }
    this._status = PaymentStatus.CAPTURED;
  }

  markFailed(): void {
    if (this._status !== PaymentStatus.PENDING && this._status !== PaymentStatus.AUTHORIZED) {
      throw new InvalidPaymentTransitionException(this._status, PaymentStatus.FAILED);
    }
    this._status = PaymentStatus.FAILED;
  }

  markRefunded(refundAmount: Money): void {
    if (this._status !== PaymentStatus.CAPTURED) {
      throw new InvalidPaymentTransitionException(this._status, PaymentStatus.REFUNDED);
    }
    if (refundAmount.currency !== this.money.currency) {
      throw new BadRequestException(`Refund currency ${refundAmount.currency} does not match payment currency ${this.money.currency}`);
    }
    if (refundAmount.toDecimal() > this.money.toDecimal()) {
      throw new BadRequestException('Refund amount cannot exceed captured amount');
    }
    // Note: If partial refunds are allowed, status might become PARTIALLY_REFUNDED, but for now we transition to REFUNDED.
    // In a more complex domain, we might track amountRefunded.
    this._status = PaymentStatus.REFUNDED;
  }

  expire(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidPaymentTransitionException(this._status, PaymentStatus.EXPIRED);
    }
    this._status = PaymentStatus.EXPIRED;
  }
}
