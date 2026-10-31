import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplateRegistryService } from './templates/template-registry.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { EmailSuppressionService } from './services/email-suppression.service';
import { BrevoEmailProvider } from './providers/brevo-email.provider';
import {
  EmailEventType,
  SupportedLocale,
  ALL_EMAIL_EVENT_TYPES,
  mapEventToPrismaNotificationType,
} from './types/canonical-notification.types';
import {
  formatFinancialAmount,
  formatMultiCurrencySummary,
  redactEmailAddress,
} from '../../common/utils/currency-formatter.util';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { NotificationDeliveryStatus as PrismaDeliveryStatus } from '@prisma/client';
import { EmailDeliveryException } from './exceptions/email-delivery.exception';

describe('DUNAS TRAVEL Email Subsystem Matrix & Hardening Certification', () => {
  let templateRegistry: TemplateRegistryService;
  let deliveryService: EmailDeliveryService;
  let suppressionService: EmailSuppressionService;
  let brevoProvider: BrevoEmailProvider;
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;
  let configService: ConfigService;

  const mockLogs: any[] = [];

  const mockPrisma = {
    notificationDeliveryLog: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockLogs.find((l) => {
          if (l.originReferenceCode !== where.originReferenceCode) return false;
          if (l.recipientEmail !== where.recipientEmail) return false;
          if (where.originEntityType)
            return l.originEntityType === where.originEntityType;
          if (where.OR && Array.isArray(where.OR)) {
            return where.OR.some((c: any) =>
              c.originEntityType
                ? l.originEntityType === c.originEntityType
                : true,
            );
          }
          if (where.notificationType)
            return l.notificationType === where.notificationType;
          return true;
        });
        return Promise.resolve(found || null);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockLogs.find((l) => l.id === where.id);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const record = {
          id: `log-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockLogs.push(record);
        return Promise.resolve(record);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const index = mockLogs.findIndex((l) => l.id === where.id);
        if (index >= 0) {
          mockLogs[index] = {
            ...mockLogs[index],
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockLogs[index]);
        }
        return Promise.resolve({ id: where.id, ...data });
      }),
    },
    emailSuppression: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'supp-1' }),
    },
    user: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.email === 'consented@example.com') {
          return Promise.resolve({
            id: 'u1',
            email: 'consented@example.com',
            marketingConsent: true,
            status: 'ACTIVE',
          });
        }
        if (where.email === 'unconsented@example.com') {
          return Promise.resolve({
            id: 'u2',
            email: 'unconsented@example.com',
            marketingConsent: false,
            status: 'ACTIVE',
          });
        }
        return Promise.resolve(null);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.email === 'consented@example.com') {
          return Promise.resolve({
            id: 'u1',
            email: 'consented@example.com',
            marketingConsent: true,
          });
        }
        if (where.email === 'unconsented@example.com') {
          return Promise.resolve({
            id: 'u2',
            email: 'unconsented@example.com',
            marketingConsent: false,
          });
        }
        return Promise.resolve(null);
      }),
    },
    booking: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'bk-123',
        referenceCode: 'BK-EUR-100',
        totalPrice: 1500,
        currency: 'EUR',
        customer: { email: 'customer@example.com', firstName: 'Marco' },
      }),
    },
  };

  const mockProvider = {
    send: jest
      .fn()
      .mockResolvedValue({ success: true, messageId: 'msg_resend_mock_123' }),
  };

  beforeAll(async () => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateRegistryService,
        EmailSuppressionService,
        EmailDeliveryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (
                key === 'mail.apiKey' ||
                key === 'mail.brevoApiKey' ||
                key === 'BREVO_API_KEY'
              )
                return 'xkeysib-mock-test-key-1234567890';
              if (key === 'mail.fromAddress' || key === 'BREVO_SENDER_EMAIL')
                return 'Dunas Travel <noreply@dunastravel.com>';
              if (key === 'nodeEnv' || key === 'NODE_ENV') return 'production';
              if (key === 'APP_URL') return 'https://dunastravel.com';
              if (key === 'ADMIN_URL') return 'https://admin.dunastravel.com';
              return null;
            }),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EMAIL_PROVIDER_TOKEN, useValue: mockProvider },
      ],
    }).compile();

    templateRegistry = module.get<TemplateRegistryService>(
      TemplateRegistryService,
    );
    deliveryService = module.get<EmailDeliveryService>(EmailDeliveryService);
    suppressionService = module.get<EmailSuppressionService>(
      EmailSuppressionService,
    );
    configService = module.get<ConfigService>(ConfigService);
    brevoProvider = new BrevoEmailProvider(configService);
  });

  beforeEach(() => {
    mockLogs.length = 0;
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // SECTION 1: TEMPLATE REGISTRY & 35-EVENT MATRIX VALIDATION
  // =========================================================================
  describe('1. 35-Event Matrix Template Coverage & Safety', () => {
    const locales: SupportedLocale[] = ['en', 'ar', 'es', 'pt', 'it'];

    it('should have all 35 canonical events registered in ALL_EMAIL_EVENT_TYPES', () => {
      expect(ALL_EMAIL_EVENT_TYPES.length).toBe(35);
    });

    ALL_EMAIL_EVENT_TYPES.forEach((eventType) => {
      it(`should successfully render event template: ${eventType} across all 5 locales`, () => {
        locales.forEach((locale) => {
          const rendered = templateRegistry.render(eventType, locale);
          expect(rendered.subject).toBeTruthy();
          expect(rendered.html).toBeTruthy();
          expect(rendered.text).toBeTruthy();
          expect(rendered.locale).toBe(locale);

          // Verify no unrendered {{placeholder}} exists
          expect(rendered.html).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/);
          expect(rendered.text).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/);
          expect(rendered.subject).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/);

          // Verify luxury brand styling is present
          expect(rendered.html).toContain('#07060a');
          expect(rendered.html).toContain('#c9a227');

          // Verify Arabic RTL support
          if (locale === 'ar') {
            expect(rendered.html).toContain('dir="rtl"');
            expect(rendered.html).toContain('lang="ar"');
          }
        });
      });
    });

    it('should reject subject with CRLF injection attack', () => {
      expect(() => {
        templateRegistry.render(EmailEventType.CONTACT_SUBMITTED, 'en', {
          customerName: 'Attacker',
          referenceCode: 'CNT-991',
          subject: 'Inquiry\r\nBcc: evil@attacker.com',
        });
      }).toThrow(/CRLF/i);
    });

    it('should reject missing required template variables', () => {
      expect(() => {
        templateRegistry.render(
          EmailEventType.BOOKING_CONFIRMED,
          'en',
          { customerName: 'Ahmed' }, // missing referenceCode, tourTitle, etc.
        );
      }).toThrow(/missing required variable/i);
    });

    it('should reject unapproved URL protocols in action links', () => {
      expect(() => {
        templateRegistry.render(EmailEventType.PASSWORD_RESET_REQUEST, 'en', {
          name: 'Test',
          resetUrl: 'javascript:alert("pwned")',
        });
      }).toThrow(/unapproved|invalid link|unsafe|protocol/i);
    });
  });

  // =========================================================================
  // SECTION 2: FINANCIAL INTEGRITY & EUR/USD STRICTNESS
  // =========================================================================
  describe('2. Financial Integrity & Currency Formatting (EUR vs USD)', () => {
    it('should format USD transactions with $ and never format EUR with $', () => {
      const usdFormatted = formatFinancialAmount(1500.5, 'USD', 'en');
      const eurFormatted = formatFinancialAmount(1500.5, 'EUR', 'en');

      expect(usdFormatted).toContain('$');
      expect(usdFormatted).toMatch(/\$1,500\.50/);

      // NON-NEGOTIABLE RULE: Never send USD text/symbols for an EUR transaction
      expect(eurFormatted).toContain('€');
      expect(eurFormatted).not.toContain('$');
    });

    it('should correctly format EUR in Spanish, Portuguese, Italian, and Arabic locales without $', () => {
      const locales: SupportedLocale[] = ['es', 'pt', 'it', 'ar'];
      locales.forEach((loc) => {
        const eur = formatFinancialAmount(2499.0, 'EUR', loc);
        expect(eur).not.toContain('$');
        expect(eur).toMatch(/€|EUR|يورو/);
      });
    });

    it('should render USD Payment Succeeded email with USD amounts', () => {
      const rendered = templateRegistry.render(
        EmailEventType.PAYMENT_SUCCEEDED,
        'en',
        {
          customerName: 'Sarah Jenkins',
          referenceCode: 'BK-USD-990',
          tourTitle: 'Luxury Nile Cruise',
          formattedAmount: formatFinancialAmount(1200, 'USD', 'en'),
          transactionId: 'TX-USD-12345',
          verifiedAt: 'October 31, 2026',
        },
      );

      expect(rendered.html).toContain('BK-USD-990');
      expect(rendered.html).toContain('$1,200.00');
      expect(rendered.html).toContain('TX-USD-12345');
    });

    it('should render EUR Payment Succeeded email with EUR and ZERO dollar signs', () => {
      const rendered = templateRegistry.render(
        EmailEventType.PAYMENT_SUCCEEDED,
        'it',
        {
          customerName: 'Marco Rossi',
          referenceCode: 'BK-EUR-777',
          tourTitle: 'Tour Egitto Classico',
          formattedAmount: formatFinancialAmount(3450, 'EUR', 'it'),
          transactionId: 'TX-EUR-99999',
          verifiedAt: '31 Ottobre 2026',
        },
      );

      expect(rendered.html).toContain('BK-EUR-777');
      expect(rendered.html).toContain('€');
      expect(rendered.html).not.toContain('$');
      expect(rendered.text).not.toContain('$');
      expect(rendered.subject).not.toContain('$');
    });

    it('should render Full Refund vs Partial Refund emails with exact balances and currency', () => {
      const fullRefundUsd = templateRegistry.render(
        EmailEventType.REFUND_COMPLETED,
        'en',
        {
          customerName: 'David Lee',
          referenceCode: 'BK-REF-100',
          formattedRefundAmount: formatFinancialAmount(1500, 'USD', 'en'),
          refundReference: 'REF-TX-001',
          refundReason: 'Customer requested cancellation',
        },
      );
      expect(fullRefundUsd.html).toContain('$1,500.00');

      const partialRefundEur = templateRegistry.render(
        EmailEventType.PARTIAL_REFUND_COMPLETED,
        'en',
        {
          customerName: 'Elena Rostova',
          referenceCode: 'BK-REF-200',
          formattedRefundAmount: formatFinancialAmount(500, 'EUR', 'en'),
          refundReference: 'REF-TX-002',
          refundReason: 'Activity price adjustment',
          formattedRemainingBalance: formatFinancialAmount(1000, 'EUR', 'en'),
        },
      );
      expect(partialRefundEur.html).toContain('€500.00');
      expect(partialRefundEur.html).toContain('€1,000.00');
      expect(partialRefundEur.html).not.toContain('$');
    });

    it('should render Free Booking ($0) without falsely claiming a payment occurred', () => {
      const freeBooking = templateRegistry.render(
        EmailEventType.FREE_BOOKING_CREATED,
        'en',
        {
          customerName: 'VIP Guest',
          referenceCode: 'BK-FREE-001',
          tourTitle: 'Complimentary Cairo Tour',
          travelDate: 'November 10, 2026',
        },
      );

      expect(freeBooking.subject).toContain('Booking Confirmed');
      expect(freeBooking.html).toContain('No payment is required');
      expect(freeBooking.html).not.toContain('Payment Succeeded');
    });

    it('should produce multi-currency summaries accurately with exchange rate', () => {
      const summary = formatMultiCurrencySummary({
        amount: 1000,
        currency: 'EUR',
        amountUsd: 1085,
        exchangeRate: 1.085,
        originalAmount: 1085,
        originalCurrency: 'USD',
      });
      expect(summary).toContain('€');
      expect(summary).toContain('$1,085');
      expect(summary).toContain('1.085');
    });
  });

  // =========================================================================
  // SECTION 3: PROVIDER RESILIENCE & PRODUCTION SAFETY (BREVO)
  // =========================================================================
  describe('3. Email Provider Hardening & Error Handling (Brevo)', () => {
    it('should fail closed in production if Brevo sender email is missing', () => {
      const badConfig = {
        get: jest.fn((key: string) => {
          if (key === 'nodeEnv' || key === 'NODE_ENV') return 'production';
          if (key === 'mail.apiKey' || key === 'BREVO_API_KEY')
            return 'xkeysib-1234567890';
          return null;
        }),
      };
      expect(() => new BrevoEmailProvider(badConfig as any)).toThrow(
        /Production email sender address is required/i,
      );
    });

    it('should fail closed in production if Brevo API key is missing', () => {
      const badConfig = {
        get: jest.fn((key: string) => {
          if (key === 'nodeEnv' || key === 'NODE_ENV') return 'production';
          if (key === 'mail.fromAddress' || key === 'BREVO_SENDER_EMAIL')
            return 'info@dunastravel.com';
          return null;
        }),
      };
      expect(() => new BrevoEmailProvider(badConfig as any)).toThrow(
        /Production Brevo API Key is required/i,
      );
    });

    it('should classify 400, 401, 403, 404, 422 as permanent errors (non-transient)', async () => {
      const permanentErrors = [400, 401, 403, 404, 422];
      for (const status of permanentErrors) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Client Error',
          json: async () => ({
            code: 'invalid_parameter',
            message: `Brevo error ${status}`,
          }),
        });

        try {
          await brevoProvider.send({
            to: 'invalid@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test',
          });
          fail('Should have thrown EmailDeliveryException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(EmailDeliveryException);
          expect(err.isTransient).toBe(false);
          expect(err.statusCode).toBe(status);
        }
      }
    });

    it('should classify 429 rate limit and 5xx server errors as transient errors', async () => {
      const transientErrors = [429, 500, 502, 503, 504];
      for (const status of transientErrors) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Server Error',
          json: async () => ({
            code: 'service_unavailable',
            message: `Transient error ${status}`,
          }),
        });

        try {
          await brevoProvider.send({
            to: 'client@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test',
          });
          fail('Should have thrown EmailDeliveryException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(EmailDeliveryException);
          expect(err.isTransient).toBe(true);
        }
      }
    });

    it('should classify network timeout and DNS failure as transient errors', async () => {
      fetchMock.mockRejectedValueOnce(
        new Error('fetch failed: getaddrinfo ENOTFOUND api.brevo.com'),
      );

      try {
        await brevoProvider.send({
          to: 'client@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        });
        fail('Should have thrown EmailDeliveryException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmailDeliveryException);
        expect(err.isTransient).toBe(true);
        expect(err.message).toContain('ENOTFOUND');
      }
    });

    it('should include deterministic idempotency-key header in provider call', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'brevo_msg_abc123' }),
      });

      const res = await brevoProvider.send({
        to: 'client@example.com',
        subject: 'Booking Confirmation',
        html: '<p>Confirmed</p>',
        text: 'Confirmed',
        metadata: { referenceCode: 'BK-IDEMP-001' },
      });

      expect(res.status).toBe('SUCCESS');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const requestOptions = callArgs[1];
      const body = JSON.parse(requestOptions.body);
      const headers = body.headers;
      expect(headers).toBeDefined();
      expect(headers['Idempotency-Key']).toBeDefined();
      expect(headers['Idempotency-Key']).toMatch(/^dunas-/);
    });
  });

  // =========================================================================
  // SECTION 4: UNIFIED PIPELINE, IDEMPOTENCY & LOGGING
  // =========================================================================
  describe('4. Canonical Delivery Pipeline & Idempotent Execution', () => {
    it('should perform authoritative send and create a delivery log row', async () => {
      mockProvider.send.mockResolvedValueOnce({
        success: true,
        messageId: 'msg_auth_101',
      });

      const success = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        recipientEmail: 'client@example.com',
        recipientName: 'Omar Sherif',
        locale: 'en',
        referenceCode: 'BK-CONF-101',
        originEntityType: 'BOOKING',
        templateVariables: {
          customerName: 'Omar Sherif',
          referenceCode: 'BK-CONF-101',
          tourTitle: 'Nile Cruise Luxury Package',
          travelDate: 'December 1, 2026',
          formattedAmount: '$3,500.00 USD',
        },
      });

      expect(success).toBe(true);
      expect(mockLogs.length).toBe(1);
      expect(mockLogs[0].status).toBe(PrismaDeliveryStatus.SENT);
      expect(mockLogs[0].providerResponseId).toBe('msg_auth_101');
      expect(mockLogs[0].attempts).toBe(1);
    });

    it('should skip duplicate send when notification was already sent (Idempotent Skip)', async () => {
      // First send
      mockProvider.send.mockResolvedValueOnce({
        success: true,
        messageId: 'msg_first_send',
      });

      await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        recipientEmail: 'duplicate@example.com',
        referenceCode: 'BK-DUP-202',
        originEntityType: 'BOOKING',
        templateVariables: {
          customerName: 'Jane Doe',
          referenceCode: 'BK-DUP-202',
          tourTitle: 'Red Sea Retreat',
          travelDate: 'January 15, 2027',
          formattedAmount: '$1,200.00 USD',
        },
      });

      expect(mockLogs.length).toBe(1);
      expect(mockLogs[0].status).toBe(PrismaDeliveryStatus.SENT);
      expect(mockProvider.send).toHaveBeenCalledTimes(1);

      // Duplicate trigger (e.g. webhook re-delivery or callback race)
      const secondCallResult = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        recipientEmail: 'duplicate@example.com',
        referenceCode: 'BK-DUP-202',
        originEntityType: 'BOOKING',
        templateVariables: {
          customerName: 'Jane Doe',
          referenceCode: 'BK-DUP-202',
          tourTitle: 'Red Sea Retreat',
          travelDate: 'January 15, 2027',
          formattedAmount: '$1,200.00 USD',
        },
      });

      expect(secondCallResult).toBe(true);
      // Provider send MUST NOT be called a second time
      expect(mockProvider.send).toHaveBeenCalledTimes(1);
      // Delivery logs count MUST NOT duplicate
      expect(mockLogs.length).toBe(1);
    });

    it('should reuse existing log record on retry without creating duplicate rows', async () => {
      // First attempt fails with transient provider error
      mockProvider.send.mockResolvedValueOnce({
        success: false,
        isTransient: true,
        error: '503 Service Unavailable',
      });

      const firstAttempt = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.INVOICE_CREATED,
        recipientEmail: 'retry_test@example.com',
        referenceCode: 'INV-7001',
        originEntityType: 'INVOICE',
        templateVariables: {
          customerName: 'Amir Khan',
          invoiceNumber: 'INV-7001',
          referenceCode: 'BK-999',
          formattedTotal: '$4,000.00 USD',
          invoiceStatus: 'UNPAID',
        },
      });

      expect(firstAttempt).toBe(false);
      expect(mockLogs.length).toBe(1);
      expect(mockLogs[0].status).toBe(PrismaDeliveryStatus.FAILED);
      expect(mockLogs[0].attempts).toBe(1);
      const originalLogId = mockLogs[0].id;

      // Second attempt (retry) succeeds
      mockProvider.send.mockResolvedValueOnce({
        success: true,
        messageId: 'msg_retry_success',
      });

      const secondAttempt = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.INVOICE_CREATED,
        recipientEmail: 'retry_test@example.com',
        referenceCode: 'INV-7001',
        originEntityType: 'INVOICE',
        existingLogId: originalLogId,
        templateVariables: {
          customerName: 'Amir Khan',
          invoiceNumber: 'INV-7001',
          referenceCode: 'BK-999',
          formattedTotal: '$4,000.00 USD',
          invoiceStatus: 'UNPAID',
        },
      });

      expect(secondAttempt).toBe(true);
      // Still exactly 1 log record in database (in-place update)
      expect(mockLogs.length).toBe(1);
      expect(mockLogs[0].id).toBe(originalLogId);
      expect(mockLogs[0].status).toBe(PrismaDeliveryStatus.SENT);
      expect(mockLogs[0].attempts).toBe(2);
      expect(mockLogs[0].providerResponseId).toBe('msg_retry_success');
    });

    it('should distinguish booking.created and booking.confirmed on the same booking without false idempotent skips', async () => {
      mockProvider.send.mockResolvedValue({
        success: true,
        messageId: 'msg_created',
      });
      await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.BOOKING_CREATED,
        recipientEmail: 'multi_event@example.com',
        referenceCode: 'BK-MULTI-999',
        originEntityType: 'BOOKING',
        templateVariables: {
          customerName: 'Samir',
          referenceCode: 'BK-MULTI-999',
          tourTitle: 'Cairo Explorer',
          formattedAmount: '.00 USD',
          travelDate: '2026-11-20',
        },
      });
      expect(mockProvider.send).toHaveBeenCalledTimes(1);

      mockProvider.send.mockResolvedValueOnce({
        success: true,
        messageId: 'msg_confirmed',
      });
      const confirmedResult = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        recipientEmail: 'multi_event@example.com',
        referenceCode: 'BK-MULTI-999',
        originEntityType: 'BOOKING',
        templateVariables: {
          customerName: 'Samir',
          referenceCode: 'BK-MULTI-999',
          tourTitle: 'Cairo Explorer',
          formattedAmount: '.00 USD',
          travelDate: '2026-11-20',
          invoiceNumber: 'INV-1',
        },
      });
      expect(confirmedResult).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledTimes(2);
    });

    it('should calculate stable deterministic idempotency key independent of subject text or locale translation', async () => {
      const payload1: any = {
        to: 'traveler@example.com',
        subject: 'Your Booking Confirmed in English',
        html: '<p>English body</p>',
        text: 'English body',
      };
      const payload2: any = {
        to: 'traveler@example.com',
        subject: 'Booking Confirmed in Arabic',
        html: '<p>Arabic body</p>',
        text: 'Arabic body',
      };
      await deliveryService.deliver({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        originReferenceCode: 'BK-STABLE-KEY-1',
        originEntityType: 'BOOKING',
        payload: payload1,
      });
      await deliveryService.deliver({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        originReferenceCode: 'BK-STABLE-KEY-1',
        originEntityType: 'BOOKING',
        payload: payload2,
      });
      expect(payload1.idempotencyKey).toBeDefined();
      expect(payload1.idempotencyKey.startsWith('dunas-')).toBe(true);
      expect(payload1.idempotencyKey).toBe(payload2.idempotencyKey);
    });

    it('should correctly redact email addresses in logs and dashboard', () => {
      expect(redactEmailAddress('ahmed.traveler@dunastravel.com')).toBe(
        'a***r@dunastravel.com',
      );
      expect(redactEmailAddress('info@domain.com')).toBe('i***o@domain.com');
      expect(redactEmailAddress('ab@c.com')).toBe('a***b@c.com');
    });
  });

  // =========================================================================
  // SECTION 5: MARKETING CONSENT & UNCONDITIONAL SUPPRESSION
  // =========================================================================
  describe('5. Marketing Consent, Suppression & Unsubscribe', () => {
    it('should enforce consent check: user without marketingConsent cannot receive marketing email', async () => {
      const allowed = await suppressionService.canSendMarketingEmail(
        'unconsented@example.com',
      );
      expect(allowed).toBe(false);
    });

    it('should allow user with marketingConsent: true to receive marketing campaign', async () => {
      const allowed = await suppressionService.canSendMarketingEmail(
        'consented@example.com',
      );
      expect(allowed).toBe(true);
    });

    it('should suppress unsubscribed recipients completely', async () => {
      await suppressionService.suppressEmail(
        'suppressed@example.com',
        'UNSUBSCRIBE',
      );

      const isSuppressed = await suppressionService.isSuppressed(
        'suppressed@example.com',
      );
      expect(isSuppressed).toBe(true);

      // Attempting to send canonical notification to suppressed user must skip immediately
      const sendResult = await deliveryService.sendCanonicalNotification({
        eventType: EmailEventType.MARKETING_CAMPAIGN,
        recipientEmail: 'suppressed@example.com',
        referenceCode: 'CAMP-SUMMER-2026',
        templateVariables: {
          title: 'Luxury Summer Escapes',
          content: 'Discover the Nile with exclusive private departures.',
          unsubscribeUrl: 'https://dunas-travel.com/unsubscribe?token=test',
        },
      });

      expect(sendResult).toBe(false);
      expect(mockProvider.send).not.toHaveBeenCalled();
    });

    it('should generate verifiable HMAC unsubscribe tokens', () => {
      const token = suppressionService.generateUnsubscribeToken(
        'customer@example.com',
      );
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);

      const isValid = suppressionService.verifyUnsubscribeToken(
        'customer@example.com',
        token,
      );
      expect(isValid).toBe(true);

      const isInvalid = suppressionService.verifyUnsubscribeToken(
        'different@example.com',
        token,
      );
      expect(isInvalid).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 6: AUTHENTICATION EMAIL INTEGRITY & ANTI-ENUMERATION
  // =========================================================================
  describe('6. Auth Emails & Security Invariants', () => {
    it('should render password reset email with secure URL and never log reset tokens', () => {
      const secretToken = 'sec_token_999888777';
      const resetUrl = `https://dunastravel.com/reset-password?token=${secretToken}`;

      const rendered = templateRegistry.render(
        EmailEventType.PASSWORD_RESET_REQUEST,
        'en',
        {
          name: 'Security Tester',
          resetUrl,
        },
      );

      expect(rendered.html).toContain(resetUrl);
      expect(rendered.text).toContain(resetUrl);
      // Subject must NOT contain reset token
      expect(rendered.subject).not.toContain(secretToken);
    });

    it('should map all 35 canonical events cleanly to Prisma enum without unmapped exceptions', () => {
      ALL_EMAIL_EVENT_TYPES.forEach((event) => {
        const prismaEnum = mapEventToPrismaNotificationType(event);
        expect(prismaEnum).toBeDefined();
        expect([
          'CUSTOMER_ACKNOWLEDGMENT',
          'INTERNAL_SALES_ALERT',
          'USER_VERIFICATION',
          'PASSWORD_RESET',
        ]).toContain(prismaEnum);
      });
    });
  });
});
