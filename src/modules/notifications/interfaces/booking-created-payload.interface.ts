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
}
