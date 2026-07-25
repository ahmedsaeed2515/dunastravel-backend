import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingCreatedListener } from './booking-created.listener';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../providers/email-provider.interface';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import { NotificationDeliveryStatus } from '../types';

describe('BookingCreatedListener', () => {
  let listener: BookingCreatedListener;
  let emailProvider: jest.Mocked<IEmailProvider>;
  let prismaService: Record<string, any>;

  beforeEach(async () => {
    emailProvider = {
      send: jest
        .fn()
        .mockResolvedValue({ status: 'SUCCESS', providerMessageId: '123' }),
    };

    prismaService = {
      notificationDeliveryLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCreatedListener,
        { provide: EMAIL_PROVIDER_TOKEN, useValue: emailProvider },
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-val'),
          },
        },
      ],
    }).compile();

    listener = module.get<BookingCreatedListener>(BookingCreatedListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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

  it('should trigger customer email and sales team email sends', async () => {
    await listener.handleBookingCreatedEvent(validPayload);
    expect(emailProvider.send).toHaveBeenCalledTimes(2);
  });

  it('should write two NotificationDeliveryLog records', async () => {
    await listener.handleBookingCreatedEvent(validPayload);
    expect(prismaService.notificationDeliveryLog.create).toHaveBeenCalledTimes(
      2,
    );
  });

  it('should retry up to max attempts on failure and write EXHAUSTED/FAILED', async () => {
    emailProvider.send.mockRejectedValue(new Error('Simulated failure'));

    // speed up the test by mocking setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return {} as any;
    });

    await listener.handleBookingCreatedEvent(validPayload);

    // 2 emails * 3 retries = 6 calls
    expect(emailProvider.send).toHaveBeenCalledTimes(6);
    expect(prismaService.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationDeliveryStatus.EXHAUSTED,
        }),
      }),
    );
  });

  it('should log error and return without sending if customerEmail is missing', async () => {
    const invalid = { ...validPayload, customerEmail: '' };
    await listener.handleBookingCreatedEvent(invalid);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('should log error and return without sending if referenceCode is missing', async () => {
    const invalid = { ...validPayload, referenceCode: '' };
    await listener.handleBookingCreatedEvent(invalid);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
