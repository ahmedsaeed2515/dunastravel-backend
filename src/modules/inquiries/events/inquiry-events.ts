export const INQUIRY_EVENTS = {
  CREATED: 'inquiry.created',
} as const;

export interface InquiryCreatedPayload {
  referenceCode: string;
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  destinations: string[];
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  budgetAmount: string | null;
  budgetCurrency: string | null;
  notes: string | null;
  createdAt: string;
}
