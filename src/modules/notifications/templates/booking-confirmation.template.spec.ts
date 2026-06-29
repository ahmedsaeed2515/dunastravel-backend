import { renderBookingCustomerConfirmation } from './booking-confirmation.template';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';

describe('renderBookingCustomerConfirmation', () => {
  const payload: BookingCreatedPayload = {
    referenceCode: 'BK-123456',
    invoiceNumber: 'INV-2026-10',
    tourTitle: 'Awesome Tour <script>',
    totalAmountUsd: '1500.00',
    arrivalDate: new Date('2026-08-15'),
    customerEmail: 'test@example.com',
    customerName: 'John <Smith>',
    adults: 2,
    children: 1,
    infants: 0,
  };

  it('should return EmailPayload with correct to, subject, and non-empty html', () => {
    const result = renderBookingCustomerConfirmation(payload);
    expect(result.to).toBe('test@example.com');
    expect(result.subject).toContain('Awesome Tour &lt;script&gt;');
    expect(result.subject).toContain('BK-123456');
    expect(result.html).toBeDefined();
    expect(result.html.length).toBeGreaterThan(0);
  });

  it('should HTML-escape special characters in customer name (e.g., <script> in name field)', () => {
    const result = renderBookingCustomerConfirmation(payload);
    expect(result.html).toContain('John &lt;Smith&gt;');
    expect(result.text).toContain('John &lt;Smith&gt;');
  });

  it('should contain booking reference code, tour name, and formatted total price', () => {
    const result = renderBookingCustomerConfirmation(payload);
    expect(result.html).toContain('BK-123456');
    expect(result.html).toContain('Awesome Tour &lt;script&gt;');
    expect(result.html).toContain('$1500.00');
  });
});
