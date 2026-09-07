export interface EmailPayload {
  to: string;
  from?: string; // Configured globally, caller provides none/override which is ignored
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface EmailResult {
  status: 'SUCCESS' | 'FAILED';
  providerMessageId?: string;
  providerError?: string;
  sentAt: Date;
}
