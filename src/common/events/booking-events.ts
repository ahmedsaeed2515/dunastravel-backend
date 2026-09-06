export const BOOKING_EVENTS = {
  CREATED: 'booking.created',
  CONFIRMED: 'booking.confirmed',
  CANCELLED: 'booking.cancelled',
};

export interface BookingCreatedPayload {
  referenceCode: string;
  invoiceNumber: string;
  tourTitle: string;
  totalAmountUsd: string;
  arrivalDate: Date;
  customerEmail: string;
  customerName: string;
  adults: number;
  children: number;
  infants: number;
  userId?: string;
}
