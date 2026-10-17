import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload, EmailResult } from '../types/email-payload.type';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';

import crypto from 'crypto';

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
    const idempotencyKey =
      payload.idempotencyKey ||
      `dunas-${crypto
        .createHash('sha256')
        .update(
          `${payload.to}:${payload.subject}:${(payload.text || '').slice(0, 100)}`,
        )
        .digest('hex')}`;

    const headers: Record<string, string> = {
      'Idempotency-Key': idempotencyKey,
    };

    try {
      const sendOptions: any = {
        from: this.fromAddress || 'DunasTravel <onboarding@resend.dev>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        headers,
        tags: payload.tags
          ? Object.entries(payload.tags).map(([name, value]) => ({
              name,
              value,
            }))
          : undefined,
      };

      let response = await this.resend.emails.send(sendOptions, { headers });

      if (
        response.error &&
        (response.error.message?.toLowerCase().includes('domain') ||
          response.error.message?.toLowerCase().includes('testing'))
      ) {
        this.logger.warn(
          `Resend API error with custom domain (${response.error.message}). Attempting fallback to onboarding@resend.dev...`,
        );
        sendOptions.from = 'DunasTravel <onboarding@resend.dev>';
        response = await this.resend.emails.send(sendOptions, { headers });
      }

      if (response.error) {
        const statusCode =
          (response.error as any).statusCode || (response.error as any).status;
        const isTransient = this.classifyTransient(
          statusCode,
          response.error.name,
          response.error.message,
        );

        this.logger.error(
          `Resend API returned error [domain=${this.extractDomain(payload.to)}, transient=${isTransient}]: ${response.error.message}`,
        );

        throw new EmailDeliveryException(
          response.error.message,
          response.error.name,
          statusCode,
          isTransient,
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
      const isTransient = this.classifyTransient(
        undefined,
        error.name,
        error.message,
      );
      this.logger.error(
        `Failed to send email via Resend [domain=${this.extractDomain(payload.to)}, transient=${isTransient}]: ${error.message}`,
      );
      throw new EmailDeliveryException(
        error.message,
        error.name || 'UNKNOWN',
        error.statusCode || error.status,
        isTransient,
      );
    }
  }

  private classifyTransient(
    statusCode?: number,
    errorName?: string,
    message?: string,
  ): boolean {
    if (statusCode) {
      if (statusCode === 429) return true; // Rate limit — transient
      if (statusCode >= 400 && statusCode < 500) return false; // 4xx client errors — permanent
      if (statusCode >= 500) return true; // 5xx server errors — transient
    }
    const lower = (message || '').toLowerCase();
    if (
      lower.includes('validation') ||
      lower.includes('invalid') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('not found') ||
      lower.includes('domain')
    ) {
      return false;
    }
    return true;
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || 'unknown-domain';
  }
}
