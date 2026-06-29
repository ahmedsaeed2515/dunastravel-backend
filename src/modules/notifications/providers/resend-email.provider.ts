import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload, EmailResult } from '../types/email-payload.type';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('mail.apiKey');
    this.fromAddress = this.configService.get<string>('mail.fromAddress') || '';
    const fromName = this.configService.get<string>('mail.fromName') || '';

    // We expect ConfigModule validation to ensure these exist,
    // but defensive defaults protect against accidental misconfiguration.
    if (fromName && this.fromAddress) {
      this.fromAddress = `${fromName} <${this.fromAddress}>`;
    }

    if (!apiKey) {
      throw new Error('Resend API Key is missing');
    }

    this.resend = new Resend(apiKey);
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    try {
      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        tags: payload.tags
          ? Object.entries(payload.tags).map(([name, value]) => ({
              name,
              value,
            }))
          : undefined,
      });

      if (response.error) {
        this.logger.error(
          `Resend API returned error [domain=${this.extractDomain(payload.to)}]: ${response.error.message}`,
        );
        throw new EmailDeliveryException(
          response.error.message,
          response.error.name,
        );
      }

      this.logger.log(
        `Email delivered [id=${response.data?.id}, domain=${this.extractDomain(payload.to)}]`,
      );

      return {
        status: 'SUCCESS',
        providerMessageId: response.data?.id,
        sentAt: new Date(),
      };
    } catch (error: any) {
      if (error instanceof EmailDeliveryException) {
        throw error;
      }
      this.logger.error(
        `Failed to send email via Resend [domain=${this.extractDomain(payload.to)}]: ${error.message}`,
      );
      throw new EmailDeliveryException(error.message, error.name || 'UNKNOWN');
    }
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || 'unknown-domain';
  }
}
