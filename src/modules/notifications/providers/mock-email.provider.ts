import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload, EmailResult } from '../types/email-payload.type';

@Injectable()
export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async send(payload: EmailPayload): Promise<EmailResult> {
    this.logger.warn(
      `[MOCK_TRANSPORT] Simulating email delivery [domain=${this.extractDomain(payload.to)}, subject='${payload.subject}']`,
    );

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return a mocked success response
    return {
      status: 'SUCCESS',
      providerMessageId: `mock-msg-id-${Date.now()}`,
      sentAt: new Date(),
    };
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || 'unknown-domain';
  }
}
