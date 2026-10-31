import { Test, TestingModule } from '@nestjs/testing';
import {
  EmailRetrySchedulerService,
  MAX_RETRY_ATTEMPTS,
} from './email-retry-scheduler.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import { NotificationDeliveryStatus } from '@prisma/client';

describe('EmailRetrySchedulerService', () => {
  let service: EmailRetrySchedulerService;
  let prisma: any;
  let notificationsService: any;

  beforeEach(async () => {
    prisma = {
      notificationDeliveryLog: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    notificationsService = {
      retryNotification: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailRetrySchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<EmailRetrySchedulerService>(
      EmailRetrySchedulerService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process eligible failed deliveries older than cooldown', async () => {
    const pastDate = new Date(Date.now() - 120 * 1000); // 2 minutes ago
    const mockLogs = [
      {
        id: 'log-1',
        status: NotificationDeliveryStatus.FAILED,
        attempts: 1,
        lastAttemptAt: pastDate,
      },
    ];

    prisma.notificationDeliveryLog.findMany.mockResolvedValueOnce(mockLogs);
    prisma.notificationDeliveryLog.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const count = await service.processPendingRetries();
    expect(count).toBe(1);
    expect(prisma.notificationDeliveryLog.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'log-1',
        status: NotificationDeliveryStatus.FAILED,
        attempts: 1,
      },
      data: expect.objectContaining({
        attempts: { increment: 1 },
      }),
    });
    expect(notificationsService.retryNotification).toHaveBeenCalledWith(
      'log-1',
    );
  });

  it('should skip rows when cooldown tier has not elapsed', async () => {
    const recentDate = new Date(Date.now() - 10 * 1000); // only 10 seconds ago
    const mockLogs = [
      {
        id: 'log-recent',
        status: NotificationDeliveryStatus.FAILED,
        attempts: 1,
        lastAttemptAt: recentDate,
      },
    ];

    prisma.notificationDeliveryLog.findMany.mockResolvedValueOnce(mockLogs);

    const count = await service.processPendingRetries();
    expect(count).toBe(0);
    expect(prisma.notificationDeliveryLog.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.retryNotification).not.toHaveBeenCalled();
  });

  it('should prevent double claiming when two concurrent workers race for the same record', async () => {
    const pastDate = new Date(Date.now() - 120 * 1000);
    const mockLogs = [
      {
        id: 'log-race',
        status: NotificationDeliveryStatus.FAILED,
        attempts: 1,
        lastAttemptAt: pastDate,
      },
    ];

    prisma.notificationDeliveryLog.findMany.mockResolvedValue(mockLogs);

    // Worker 1 succeeds, Worker 2 gets count 0 because attempts was already incremented
    prisma.notificationDeliveryLog.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    // Simulate Worker 1 run
    const count1 = await service.processPendingRetries();
    expect(count1).toBe(1);
    expect(notificationsService.retryNotification).toHaveBeenCalledTimes(1);

    // Simulate Worker 2 run on the same record
    const count2 = await service.processPendingRetries();
    expect(count2).toBe(0);
    // notificationsService.retryNotification is NOT called again for Worker 2
    expect(notificationsService.retryNotification).toHaveBeenCalledTimes(1);
  });

  it('should mark record EXHAUSTED when retry fails at MAX_RETRY_ATTEMPTS', async () => {
    const pastDate = new Date(Date.now() - 700 * 1000);
    const mockLogs = [
      {
        id: 'log-exhaust',
        status: NotificationDeliveryStatus.FAILED,
        attempts: 2, // will become attempt 3
        lastAttemptAt: pastDate,
      },
    ];

    prisma.notificationDeliveryLog.findMany.mockResolvedValueOnce(mockLogs);
    prisma.notificationDeliveryLog.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    notificationsService.retryNotification.mockRejectedValueOnce(
      new Error('Provider timeout 504'),
    );

    const count = await service.processPendingRetries();
    expect(count).toBe(0);
    expect(prisma.notificationDeliveryLog.update).toHaveBeenCalledWith({
      where: { id: 'log-exhaust' },
      data: expect.objectContaining({
        status: NotificationDeliveryStatus.EXHAUSTED,
      }),
    });
  });

  it('should respect re-entrancy guard: skips execution if a pass is already running', async () => {
    (service as any).isProcessing = true;
    const count = await service.processPendingRetries();
    expect(count).toBe(0);
    expect(prisma.notificationDeliveryLog.findMany).not.toHaveBeenCalled();
  });
});
