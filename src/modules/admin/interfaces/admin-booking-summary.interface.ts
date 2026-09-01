export interface IAdminBookingSummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly paidAmount?: string;
  readonly currency: string;
  readonly passengerCount: number;
  readonly adults?: number;
  readonly children?: number;
  readonly infants?: number;
  readonly tourId: string;
  readonly tourSlug: string;
  readonly tourNameEn: string;
  readonly invoiceNumber: string | null;
  readonly arrivalDate?: Date | null;
  readonly departureDate?: Date | null;
  readonly transportChoice?: string | null;
  readonly language?: string | null;
  readonly bookingType?: string;
  readonly priority?: string;
  readonly billingInfo?: {
    readonly fullName: string;
    readonly email: string;
    readonly phone: string | null;
    readonly country: string | null;
    readonly city: string | null;
  } | null;
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly createdAt: Date;
}

