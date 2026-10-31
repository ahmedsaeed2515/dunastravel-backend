import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import crypto from 'crypto';

@Injectable()
export class EmailSuppressionService {
  private readonly logger = new Logger(EmailSuppressionService.name);
  private readonly inMemorySuppression = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async isSuppressed(email: string): Promise<boolean> {
    if (!email) return true;
    const normalized = email.trim().toLowerCase();
    if (this.inMemorySuppression.has(normalized)) {
      return true;
    }

    // Check user marketing consent if user exists
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: normalized, deletedAt: null },
        select: { marketingConsent: true, status: true },
      });
      if (
        user &&
        (user.marketingConsent === false || user.status !== 'ACTIVE')
      ) {
        return true;
      }
    } catch (_err) {
      // If DB is offline, rely on in-memory suppression
    }

    return false;
  }

  async suppressEmail(
    email: string,
    reason: 'UNSUBSCRIBE' | 'BOUNCE' | 'COMPLAINT',
  ): Promise<void> {
    const normalized = email.trim().toLowerCase();
    this.inMemorySuppression.add(normalized);
    this.logger.warn(`Email suppressed: ${normalized} (Reason: ${reason})`);

    try {
      await this.prisma.user.updateMany({
        where: { email: normalized },
        data: { marketingConsent: false },
      });
    } catch (_err) {
      // Safe non-blocking update
    }
  }

  checkMarketingConsent(user: {
    marketingConsent?: boolean | null;
    status?: string | null;
  }): boolean {
    if (!user) return false;
    if (user.status !== 'ACTIVE') return false;
    return user.marketingConsent === true;
  }

  async canSendMarketingEmail(email: string): Promise<boolean> {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (this.inMemorySuppression.has(normalized)) return false;
    const user = await this.prisma.user.findFirst({
      where: { email: normalized },
      select: { marketingConsent: true, status: true },
    });
    if (!user) return false;
    return user.marketingConsent === true;
  }

  generateUnsubscribeToken(email: string): string {
    const secret = process.env.JWT_SECRET || 'dunas-suppression-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(email.toLowerCase())
      .digest('hex');
  }

  verifyUnsubscribeToken(email: string, token: string): boolean {
    if (!email || !token) return false;
    const expected = this.generateUnsubscribeToken(email);
    if (token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  }

  generateUnsubscribeUrl(email: string): string {
    const secret = process.env.JWT_SECRET || 'dunas-suppression-secret';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(email.toLowerCase())
      .digest('hex');
    const baseUrl = process.env.FRONTEND_URL || 'https://dunas-travel.com';
    return `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${hmac}`;
  }
}
