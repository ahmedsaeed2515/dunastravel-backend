export interface PassengerResponse {
  id: string;
  passengerType: string;
  fullName: string;
}

export interface BillingInfoResponse {
  fullName: string;
  email: string;
  phone: string;
  invoiceType: string;
  companyName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface BookingCreatedResponse {
  id: string;
  referenceCode: string;
  invoiceNumber: string;
  status: string;
  tourTitle: string;
  arrivalDate: string;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  totalAmountUsd: string;
  currency?: string;
  originalAmount?: string;
  originalCurrency?: string;
  convertedAmount?: string;
  convertedCurrency?: string;
  exchangeRate?: string;
  exchangeRateDate?: string;
  paymentRequired?: boolean;
  passengers: PassengerResponse[];
  billing: BillingInfoResponse;
  guestToken?: string | null;
}

export interface BookingSummaryResponse {
  id: string;
  referenceCode: string;
  invoiceNumber: string | null;
  status: string;
  tourTitle: string;
  tourSlug: string;
  arrivalDate: string;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  totalAmountUsd: string;
  currency?: string;
  originalAmount?: string;
  originalCurrency?: string;
  paymentStatus: string | null;
  paymentAttemptId: string | null;
  createdAt: string;
}
