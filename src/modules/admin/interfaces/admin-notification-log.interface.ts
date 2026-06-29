export interface IAdminNotificationLog {
  readonly id: string;
  readonly channel: string;
  readonly recipient: string;
  readonly subject: string;
  readonly status: string;
  readonly attempts: number;
  readonly originEvent: string;
  readonly originReferenceCode: string;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
