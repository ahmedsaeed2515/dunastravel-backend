export interface IEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface InquiryAcknowledgmentTemplateData {
  customerName: string;
  referenceCode: string;
  destinations: string[];
  travelDateRange: string;
  numberOfTravelers: number;
  submittedAt: Date;
}

export interface InquiryInternalAlertTemplateData {
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  destinations: string[];
  travelDateRange: string;
  numberOfTravelers: number;
  specialRequests?: string;
  submittedAt: Date;
  adminDashboardUrl: string;
}

export interface ContactAcknowledgmentTemplateData {
  customerName: string;
  subject: string;
  submittedAt: Date;
}

export interface ContactInternalAlertTemplateData {
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  submittedAt: Date;
  adminDashboardUrl: string;
}

/**
 * Escapes HTML characters in user input to prevent XSS.
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
