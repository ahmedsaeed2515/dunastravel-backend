import { IAdminBookingSummary } from './admin-booking-summary.interface';

export interface IAdminBookingDetail extends IAdminBookingSummary {
  readonly passengers: ReadonlyArray<{
    readonly id: string;
    readonly fullName: string;
    readonly passengerType: string;
    readonly passportNumber: string | null;
    readonly passportExpiry: Date | null;
    readonly dateOfBirth: Date | null;
    readonly nationality: string | null;
  }>;
  readonly billingInfo: {
    readonly fullName: string;
    readonly email: string;
    readonly phone: string | null;
    readonly address: string | null;
    readonly city: string | null;
    readonly country: string | null;
  } | null;
  readonly invoice: {
    readonly id: string;
    readonly invoiceNumber: string;
    readonly createdAt: Date;
  } | null;
  readonly updatedAt: Date;
}
