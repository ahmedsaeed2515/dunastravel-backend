export interface IAdminBookingSummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly currency: string;
  readonly passengerCount: number;
  readonly tourId: string;
  readonly tourSlug: string;
  readonly tourNameEn: string;
  readonly invoiceNumber: string | null;
  readonly createdAt: Date;
}
