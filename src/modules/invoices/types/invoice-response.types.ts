export interface InvoicePassengerCountResponse {
  adults: number;
  children: number;
  infants: number;
}

export interface InvoiceBillingResponse {
  fullName: string;
  email: string;
  phone: string;
  invoiceType: string;
  companyName: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

export interface InvoiceSnapshotDiscount {
  name: string;
  amount: number | string;
  code?: string;
}

export interface InvoiceSnapshotPassenger {
  id?: string;
  passengerType: string;
  fullName: string;
  nationality?: string | null;
}

export interface InvoiceSnapshot {
  version: number;
  tourId?: string;
  tourTitle: string;
  tourSlug?: string;
  arrivalDate: string;
  departureDate?: string | null;
  adults: number;
  children: number;
  infants: number;
  baseSubtotal?: number | string;
  adultTotal?: number | string;
  childTotal?: number | string;
  seasonalAdjustment?: number | string;
  discounts?: InvoiceSnapshotDiscount[];
  tax?: number | string;
  total?: number | string;
  currency?: string;
  billingRecipient: InvoiceBillingResponse;
  passengers?: InvoiceSnapshotPassenger[];
}

export interface InvoiceResponse {
  invoiceNumber: string;
  bookingId: string;
  issuedAt: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  totalAmountUsd: string;
  currency: string;
  tourTitle: string;
  tourSlug: string;
  arrivalDate: string;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  snapshot: InvoiceSnapshot;
  billing: InvoiceBillingResponse;
}
