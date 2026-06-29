import { TailorMadeInquiryStatus } from './tailor-made-inquiry-status.type';

export interface InquiryResponse {
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
  status: TailorMadeInquiryStatus;
  createdAt: string;
  updatedAt: string;
}
