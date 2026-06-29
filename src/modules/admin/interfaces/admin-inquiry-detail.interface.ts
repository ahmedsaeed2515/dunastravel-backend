import { IAdminInquirySummary } from './admin-inquiry-summary.interface';

export interface IAdminInquiryDetail extends IAdminInquirySummary {
  readonly departureDate: Date | null;
  readonly returnDate: Date | null;
  readonly destinations: string[];
  readonly message: string | null;
  readonly budget: string | null;
  readonly locale: string;
  readonly ipAddress: string | null;
  readonly updatedAt: Date;
}
