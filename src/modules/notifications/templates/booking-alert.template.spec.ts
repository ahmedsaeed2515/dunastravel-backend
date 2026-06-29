import { renderBookingInternalAlert } from './booking-alert.template';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';

describe('renderBookingInternalAlert', () => {
  const payload: BookingCreatedPayload = {
    referenceCode: 'BK-123456',
    invoiceNumber: 'INV-2026-10',
    tourTitle: 'Awesome Tour',
    totalAmountUsd: '1500.00',
    arrivalDate: new Date('2026-08-15'),
    customerEmail: 'test@example.com',
    customerName: 'John Smith',
    adults: 2,
    children: 0,
    infants: 0,
  };

  it('should return EmailPayload with correct to (sales team address from config)', () => {
    const result = renderBookingInternalAlert(
      payload,
      'sales@dunas.com',
      'http://admin',
    );
    expect(result.to).toBe('sales@dunas.com');
  });

  it('should contain customer email for follow-up and booking reference code', () => {
    const result = renderBookingInternalAlert(
      payload,
      'sales@dunas.com',
      'http://admin',
    );
    expect(result.html).toContain('test@example.com');
    expect(result.html).toContain('BK-123456');
  });
});
