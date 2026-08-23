export interface IAdminInquirySummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly status: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly numberOfTravelers: number;
  readonly assigneeId: string | null;
  readonly createdAt: Date;
}
