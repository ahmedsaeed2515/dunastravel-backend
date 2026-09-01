export interface IAdminInquirySummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly status: string;
  readonly fullName?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly destinations?: string[];
  readonly departureDate?: Date | null;
  readonly returnDate?: Date | null;
  readonly adults?: number;
  readonly children?: number;
  readonly numberOfTravelers: number;
  readonly budgetAmount?: number | null;
  readonly budgetCurrency?: string | null;
  readonly quotedAmountUsd?: number | null;
  readonly notes?: string | null;
  readonly partnerCode?: string | null;
  readonly companyId?: string | null;
  readonly company?: {
    id: string;
    name: string;
    referenceCode: string;
    taxId?: string | null;
    tier?: string | null;
  } | null;
  readonly assigneeId: string | null;
  readonly assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  readonly bookingId?: string | null;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}
