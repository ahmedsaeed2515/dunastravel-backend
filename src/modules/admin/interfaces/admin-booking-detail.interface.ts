import { IAdminBookingSummary } from './admin-booking-summary.interface';

export interface IAdminBookingDetail extends IAdminBookingSummary {
  readonly arrivalTime?: string | null;
  readonly departureTime?: string | null;
  readonly activityType?: string | null;
  readonly notes?: string | null;
  readonly inquiryMessage?: string | null;
  readonly cancellationReason?: string | null;
  readonly tags?: readonly string[];
  readonly tour?: {
    readonly id: string;
    readonly slug: string;
    readonly titleJsonb: unknown;
    readonly subtitleJsonb?: unknown;
    readonly category?: string | null;
    readonly country?: string | null;
    readonly city?: string | null;
    readonly basePriceUsd?: string | null;
    readonly durationJsonb?: unknown;
  } | null;
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly phone?: string | null;
    readonly avatarUrl?: string | null;
    readonly role?: string;
  } | null;
  readonly assignee?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
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
    readonly invoiceType?: string;
    readonly companyName?: string | null;
    readonly taxId?: string | null;
    readonly address: string | null;
    readonly city: string | null;
    readonly country: string | null;
  } | null;
  readonly invoice: {
    readonly id: string;
    readonly invoiceNumber: string;
    readonly status?: string;
    readonly subtotal?: string;
    readonly tax?: string;
    readonly total?: string;
    readonly currency?: string;
    readonly dueDate?: Date | null;
    readonly pdfUrl?: string | null;
    readonly createdAt: Date;
  } | null;
  readonly payments?: ReadonlyArray<unknown>;
  readonly activityLogs?: ReadonlyArray<unknown>;
  readonly notesList?: ReadonlyArray<unknown>;
  readonly attachments?: ReadonlyArray<unknown>;
  readonly updatedAt: Date;
}


