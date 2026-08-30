import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCronService } from './payment-cron.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentCronService', () => {
  let service: PaymentCronService;
  let prisma: PrismaService;
  let gatewayMock: IPaymentGatewayPort;
  let paymentsServiceMock: { reconcilePaymentByProviderInvoiceId: jest.Mock };

  beforeEach(async () => {
    paymentsServiceMock = {
      reconcilePaymentByProviderInvoiceId: jest.fn().mockResolvedValue({ transition: 'SUCCEEDED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCronService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
            payment: {
              findMany: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            booking: {
              findUnique: jest.fn().mockResolvedValue({ id: 'bkg-1', promotionRedemption: null }),
            },
            bookingActivityLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: IPaymentGatewayPort,
          useValue: {
            checkStatus: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: paymentsServiceMock,
        },
      ],
    }).compile();

    service = module.get<PaymentCronService>(PaymentCronService);
    prisma = module.get<PrismaService>(PrismaService);
    gatewayMock = module.get<IPaymentGatewayPort>(IPaymentGatewayPort);
  });

  it('should expire stale pending payments when PayLink reports unpaid', async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pay-1',
        bookingId: 'bkg-1',
        transactionId: 'inv-12345',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);
    (gatewayMock.checkStatus as jest.Mock).mockResolvedValue({
      providerInvoiceId: 'inv-12345',
      providerStatus: 'UNPAID',
    });

    await service.expireStalePayments();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'pay-1', status: 'PENDING' }),
      data: expect.objectContaining({ status: 'EXPIRED' }),
    });
    expect(prisma.bookingActivityLog.create).toHaveBeenCalled();
  });

  it('should reconcile stale pending payment instead of expiring when PayLink reports PAID', async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pay-2',
        bookingId: 'bkg-2',
        transactionId: 'inv-99999',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);
    (gatewayMock.checkStatus as jest.Mock).mockResolvedValue({
      providerInvoiceId: 'inv-99999',
      providerStatus: 'PAID',
    });

    await service.expireStalePayments();

    expect(paymentsServiceMock.reconcilePaymentByProviderInvoiceId).toHaveBeenCalledWith('inv-99999');
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('should run bounded reconciliation on pending payments', async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pay-3', transactionId: 'inv-333' },
      { id: 'pay-4', transactionId: 'inv-444' },
    ]);

    await service.reconcilePendingPayments();

    expect(paymentsServiceMock.reconcilePaymentByProviderInvoiceId).toHaveBeenCalledTimes(2);
    expect(paymentsServiceMock.reconcilePaymentByProviderInvoiceId).toHaveBeenCalledWith('inv-333');
    expect(paymentsServiceMock.reconcilePaymentByProviderInvoiceId).toHaveBeenCalledWith('inv-444');
  });
});
