import { Test, TestingModule } from '@nestjs/testing';
import { AdminWalletsService } from './admin-wallets.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

describe('AdminWalletsService - reconcileLedger', () => {
  let service: AdminWalletsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      wallet: {
        findMany: jest.fn(),
      },
      walletTransaction: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminWalletsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AdminWalletsService>(AdminWalletsService);
  });

  it('should reconcile ledger with zero discrepancies when wallet balance matches transactions', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'w1', balance: new Prisma.Decimal(100) },
    ]);
    prismaMock.walletTransaction.findMany.mockResolvedValue([
      {
        id: 't1',
        walletId: 'w1',
        amount: new Prisma.Decimal(150),
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
      },
      {
        id: 't2',
        walletId: 'w1',
        amount: new Prisma.Decimal(50),
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.COMPLETED,
      },
    ]);

    const result = await service.reconcileLedger('admin-1');

    expect(result.success).toBe(true);
    expect(result.processedWallets).toBe(1);
    expect(result.totalDiscrepancies).toBe(0);
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('should detect discrepancies when wallet balance does not match transaction sum', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'w2', balance: new Prisma.Decimal(500) }, // Stored balance is 500, but sum is 100
    ]);
    prismaMock.walletTransaction.findMany.mockResolvedValue([
      {
        id: 't3',
        walletId: 'w2',
        amount: new Prisma.Decimal(100),
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.COMPLETED,
      },
    ]);

    const result = await service.reconcileLedger('admin-1');

    expect(result.success).toBe(true);
    expect(result.processedWallets).toBe(1);
    expect(result.totalDiscrepancies).toBe(1);
    expect(result.discrepancies[0].walletId).toBe('w2');
    expect(result.discrepancies[0].difference).toBe('400');
  });
});
