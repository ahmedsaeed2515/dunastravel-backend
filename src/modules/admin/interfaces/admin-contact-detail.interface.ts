import { IAdminContactSummary } from './admin-contact-summary.interface';

export interface IAdminContactDetail extends IAdminContactSummary {
  readonly message: string;
  readonly locale: string;
  readonly ipAddress: string | null;
  readonly updatedAt: Date;
}
