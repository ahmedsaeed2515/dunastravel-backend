import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BadRequestException } from '@nestjs/common';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    trackEvent: jest.fn((dto) => Promise.resolve({ success: true, eventId: 'evt_123' })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should accept valid browser events (page_view)', async () => {
    const res = await controller.trackEvent({ eventId: 'evt_001', eventName: 'page_view', locale: 'en' });
    expect(res).toEqual({ success: true, eventId: 'evt_123' });
    expect(service.trackEvent).toHaveBeenCalled();
  });

  it('should accept tour_view browser event', async () => {
    const res = await controller.trackEvent({ eventId: 'evt_002', eventName: 'tour_view', tourSlug: 'egypt-classic' });
    expect(res).toEqual({ success: true, eventId: 'evt_123' });
  });

  it('should accept tour_card_click browser event', async () => {
    const res = await controller.trackEvent({ eventId: 'evt_003', eventName: 'tour_card_click', tourSlug: 'egypt-classic', interfaceSlug: 'egypt' });
    expect(res).toEqual({ success: true, eventId: 'evt_123' });
  });

  it('should reject server-only event payment_succeeded', async () => {
    await expect(
      controller.trackEvent({ eventId: 'evt_004', eventName: 'payment_succeeded', bookingRef: 'REF123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject server-only event booking_submitted', async () => {
    await expect(
      controller.trackEvent({ eventId: 'evt_005', eventName: 'booking_submitted', bookingRef: 'REF123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject server-only event booking_confirmed', async () => {
    await expect(
      controller.trackEvent({ eventId: 'evt_006', eventName: 'booking_confirmed', bookingRef: 'REF123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject server-only event refund_completed', async () => {
    await expect(
      controller.trackEvent({ eventId: 'evt_007', eventName: 'refund_completed', bookingRef: 'REF123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject unlisted arbitrary event names', async () => {
    await expect(
      controller.trackEvent({ eventId: 'evt_008', eventName: 'arbitrary_fake_event' }),
    ).rejects.toThrow(BadRequestException);
  });
});
