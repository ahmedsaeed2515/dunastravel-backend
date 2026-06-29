export interface IAdminDashboardMetrics {
  readonly totalBookings: number;
  readonly bookingsThisMonth: number;
  readonly totalInquiries: number;
  readonly openInquiries: number;
  readonly totalContactSubmissions: number;
  readonly unreadContactSubmissions: number;
  readonly totalNotificationsSent: number;
  readonly totalNotificationsFailed: number;
  readonly recentFailedNotifications: ReadonlyArray<{
    readonly id: string;
    readonly recipient: string;
    readonly subject: string;
    readonly originEvent: string;
    readonly originReferenceCode: string;
    readonly failureReason: string | null;
    readonly createdAt: Date;
  }>;
}
