export interface IAdminContactSummary {
  readonly id: number;
  readonly referenceCode: string;
  readonly status: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly subject: string;
  readonly createdAt: Date;
}
