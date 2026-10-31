import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from './email-provider.interface';
import { EmailPayload, EmailResult } from '../types/email-payload.type';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';
import crypto from 'crypto';

@Injectable()
export class BrevoEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(BrevoEmailProvider.name);
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly isProduction: boolean;
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly configService: ConfigService) {
    const nodeEnv =
      this.configService.get<string>('nodeEnv') ||
      process.env.NODE_ENV ||
      'development';
    this.isProduction = nodeEnv === 'production';

    this.apiKey =
      this.configService.get<string>('mail.apiKey') ||
      this.configService.get<string>('mail.brevoApiKey') ||
      this.configService.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY ||
      '';

    const rawFrom =
      this.configService.get<string>('mail.fromAddress') ||
      this.configService.get<string>('BREVO_SENDER_EMAIL') ||
      process.env.FROM_EMAIL ||
      process.env.MAIL_FROM_ADDRESS ||
      '';

    this.senderName =
      this.configService.get<string>('mail.fromName') ||
      this.configService.get<string>('BREVO_SENDER_NAME') ||
      process.env.MAIL_FROM_NAME ||
      'Dunas Travel';

    this.senderEmail = this.extractEmailOnly(rawFrom);

    if (this.isProduction) {
      if (!this.senderEmail) {
        throw new Error(
          'Production email sender address is required and cannot be empty.',
        );
      }
      if (!this.apiKey) {
        throw new Error(
          'Production Brevo API Key is required and cannot be empty.',
        );
      }
    } else {
      if (!this.apiKey) {
        throw new Error('Brevo API Key is missing');
      }
    }
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

    const effectiveSender = {
      name: this.senderName || 'Dunas Travel',
      email:
        this.senderEmail ||
        (this.isProduction ? 'info@dunas-travel.com' : 'dev@dunas-travel.com'),
    };

    const requestBody: {
      sender: { name: string; email: string };
      to: Array<{ email: string; name?: string }>;
      subject: string;
      htmlContent: string;
      textContent: string;
      replyTo?: { email: string };
      tags?: string[];
      headers?: Record<string, string>;
    } = {
      sender: effectiveSender,
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
      headers: {
        'Idempotency-Key': idempotencyKey,
        ...(payload.headers || {}),
      },
    };

    if (payload.replyTo) {
      requestBody.replyTo = { email: payload.replyTo };
    }

    if (payload.tags) {
      requestBody.tags = Object.entries(payload.tags).map(([key, value]) =>
        `${key}_${value}`.replace(/[^a-zA-Z0-9_ -]/g, '_').slice(0, 50),
      );
    }

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const statusCode = response.status;
        const errorMessage =
          responseData?.message ||
          response.statusText ||
          `Brevo API request failed with status ${statusCode}`;
        const errorCode = responseData?.code || 'BREVO_ERROR';
        const isTransient = this.classifyTransient(
          statusCode,
          errorCode,
          errorMessage,
        );

        this.logger.error(
          `Brevo API returned error [domain=${this.extractDomain(payload.to)}, status=${statusCode}, code=${errorCode}, transient=${isTransient}]: ${errorMessage}`,
        );

        throw new EmailDeliveryException(
          errorMessage,
          errorCode,
          statusCode,
          isTransient,
        );
      }

      const providerMessageId =
        responseData?.messageId ||
        responseData?.messageIds?.[0] ||
        `brevo-${Date.now()}`;

      this.logger.log(
        `Email delivered via Brevo [id=${providerMessageId}, domain=${this.extractDomain(payload.to)}]`,
      );

      return {
        status: 'SUCCESS',
        success: true,
        providerMessageId,
        sentAt: new Date(),
      };
    } catch (error: any) {
      if (error instanceof EmailDeliveryException) {
        throw error;
      }

      const isTransient = this.classifyTransient(
        error.statusCode || error.status,
        error.name,
        error.message,
      );

      this.logger.error(
        `Failed to send email via Brevo [domain=${this.extractDomain(payload.to)}, transient=${isTransient}]: ${error.message}`,
      );

      throw new EmailDeliveryException(
        error.message || 'Unknown network error during Brevo email dispatch',
        error.name || 'NETWORK_ERROR',
        error.statusCode || error.status,
        isTransient,
      );
    }
  }

  private classifyTransient(
    statusCode?: number,
    errorCode?: string,
    message?: string,
  ): boolean {
    if (statusCode) {
      if (statusCode === 429) return true; // Rate limit — transient
      if (statusCode >= 400 && statusCode < 500) return false; // 4xx client errors (400, 401, 403, 404, 422) — permanent
      if (statusCode >= 500) return true; // 5xx server errors — transient
    }

    const lower = `${errorCode || ''} ${message || ''}`.toLowerCase();
    if (
      lower.includes('validation') ||
      lower.includes('invalid') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('not_found') ||
      lower.includes('not found') ||
      lower.includes('bad_request') ||
      lower.includes('syntax') ||
      lower.includes('unregistered')
    ) {
      return false;
    }

    if (
      lower.includes('timeout') ||
      lower.includes('econnreset') ||
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('rate limit') ||
      lower.includes('temporarily') ||
      lower.includes('503') ||
      lower.includes('504')
    ) {
      return true;
    }

    return true;
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || 'unknown-domain';
  }

  private extractEmailOnly(formattedAddress: string): string {
    const match = formattedAddress.match(/<([^>]+)>/);
    return match ? match[1].trim() : formattedAddress.trim();
  }
}
