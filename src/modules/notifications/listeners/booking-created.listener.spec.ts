import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingCreatedListener } from './booking-created.listener';
import { PrismaService } from '../../../prisma/prisma.service';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { TemplateRegistryService } from '../templates/template-registry.service';
import { NotificationType } from '../types';
import { EmailEventType } from '../types/canonical-notification.types';

describe('BookingCreatedListener', () => {
  let listener: BookingCreatedListener;
  let deliveryService: { deliver: jest.Mock };
  let templateRegistry: { renderTemplate: jest.Mock };
  let prismaService: Record<string, any>;

  beforeEach(async () => {
    deliveryService = {
      deliver: jest.fn().mockResolvedValue(true),
    };

    templateRegistry = {
      renderTemplate: jest.fn().mockReturnValue({
        subject: 'Test Subject',
        html: '<p>Test Html</p>',
        text: 'Test Text',
        locale: 'en',
      }),
    };

    prismaService = {
      booking: {
        findFirst: jest.fn(),
      },
      notificationDeliveryLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCreatedListener,
        { provide: EmailDeliveryService, useValue: deliveryService },
        { provide: TemplateRegistryService, useValue: templateRegistry },
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-val'),
          },
        },
        {
          provide: InAppNotificationsService,
          useValue: {
            notifyAdmins: jest.fn().mockResolvedValue([]),
            createNotification: jest.fn().mockResolvedValue({ id: 'inapp-1' }),
          },
        },
      ],
    }).compile();

    listener = module.get<BookingCreatedListener>(BookingCreatedListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validPayload: BookingCreatedPayload = {
    referenceCode: 'BK-111',
    invoiceNumber: 'INV-111',
    tourTitle: 'Test Tour',
    totalAmountUsd: '1000',
    arrivalDate: new Date(),
    customerEmail: 'test@example.com',
    customerName: 'Test Name',
    adults: 2,
    children: 0,
    infants: 0,
  };

  it('should trigger customer email and sales team email sends via EmailDeliveryService', async () => {
    await listener.handleBookingCreatedEvent(validPayload);
    expect(deliveryService.deliver).toHaveBeenCalledTimes(2);

    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EmailEventType.BOOKING_CREATED,
        notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
        originReferenceCode: 'BK-111',
        originEntityType: 'BOOKING',
      }),
    );

    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EmailEventType.BOOKING_CREATED,
        notificationType: NotificationType.INTERNAL_SALES_ALERT,
        originReferenceCode: 'BK-111',
        originEntityType: 'BOOKING',
      }),
    );
  });

  it('should log error and return without sending if customerEmail is missing', async () => {
    const invalid = { ...validPayload, customerEmail: '' };
    await listener.handleBookingCreatedEvent(invalid);
    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });

  it('should log error and return without sending if referenceCode is missing', async () => {
    const invalid = { ...validPayload, referenceCode: '' };
    await listener.handleBookingCreatedEvent(invalid);
    expect(deliveryService.deliver).not.toHaveBeenCalled();
  });

  it('should handle booking.confirmed via EmailDeliveryService with authoritative data', async () => {
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'b-123',
      referenceCode: 'BK-CONFIRMED',
      currency: 'USD',
      totalAmountUsd: 1500,
      language: 'en',
      arrivalDate: new Date('2026-12-01'),
      user: { email: 'client@example.com', name: 'Client' },
      tour: { titleJsonb: { en: 'Grand Nile Journey' } },
      invoice: { invoiceNumber: 'INV-999' },
    });

    await listener.handleBookingConfirmedEvent({
      referenceCode: 'BK-CONFIRMED',
    });

    expect(deliveryService.deliver).toHaveBeenCalledTimes(1);
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EmailEventType.BOOKING_CONFIRMED,
        originReferenceCode: 'BK-CONFIRMED',
        originEntityType: 'BOOKING',
      }),
    );
  });

  it('should handle booking.cancelled via EmailDeliveryService', async () => {
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'b-123',
      referenceCode: 'BK-CANCELLED',
      paidAmountUsd: 500,
      language: 'en',
      user: { email: 'client@example.com', name: 'Client' },
      tour: { titleJsonb: { en: 'Grand Nile Journey' } },
    });

    await listener.handleBookingCancelledEvent({
      referenceCode: 'BK-CANCELLED',
      reason: 'Change of plans',
    });

    expect(deliveryService.deliver).toHaveBeenCalledTimes(1);
    expect(deliveryService.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EmailEventType.BOOKING_CANCELLED_AFTER_PAYMENT,
        originReferenceCode: 'BK-CANCELLED',
        originEntityType: 'BOOKING',
      }),
    );
  });
});
