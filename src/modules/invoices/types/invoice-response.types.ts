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

export interface InvoiceResponse {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  tourTitle: string;
  tourSlug: string;
  arrivalDate: string;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  totalAmountUsd: string;
  billing: InvoiceBillingResponse;
}
