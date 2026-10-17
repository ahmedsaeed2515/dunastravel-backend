import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import {
  WalletOwnerType,
  WalletTransactionType,
  WalletTransactionStatus,
  Prisma,
} from '@prisma/client';

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(prisma)),
            wallet: {
              upsert: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 60 }),
              findFirst: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            walletTransaction: {
              create: jest.fn(),
              findFirst: jest.fn().mockResolvedValue(null),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            company: {
              findFirst: jest.fn().mockResolvedValue({ id: 'comp-1' }),
              update: jest.fn(),
            },
            user: {
              findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addTransaction', () => {
    it('should throw BadRequestException if debit exceeds balance', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-1', balance: 50 } as any);
      jest.spyOn(prisma.wallet, 'updateMany').mockResolvedValue({ count: 0 });

      await expect(
        service.addTransaction({
          ownerType: WalletOwnerType.USER,
          ownerId: 'user-1',
          amount: 100,
          type: WalletTransactionType.DEBIT,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process credit and update wallet balance', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-1', balance: 10 } as any);
      jest.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({
        status: WalletTransactionStatus.COMPLETED,
      } as any);

      await service.addTransaction({
        ownerType: WalletOwnerType.USER,
        ownerId: 'user-1',
        amount: 50,
        type: WalletTransactionType.CREDIT,
      } as any);

      expect(prisma.wallet.updateMany).toHaveBeenCalledWith({
        where: { id: 'wallet-1', status: 'ACTIVE' },
        data: { balance: { increment: new Prisma.Decimal(50) } },
      });
      // Should not update company balance for user
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('should process debit, update wallet balance, and sync company balance if owner is COMPANY', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-2', balance: 100 } as any);
      jest.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({
        status: WalletTransactionStatus.COMPLETED,
      } as any);

      await service.addTransaction({
        ownerType: WalletOwnerType.COMPANY,
        ownerId: 'comp-1',
        amount: 40,
        type: WalletTransactionType.DEBIT,
      } as any);

      expect(prisma.wallet.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'wallet-2',
          status: 'ACTIVE',
          balance: { gte: new Prisma.Decimal(40) },
        },
        data: { balance: { decrement: new Prisma.Decimal(40) } },
      });
      // Should update company balance
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { currentBalance: 60 },
      });
    });

    it('should not update balance if transaction is PENDING', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-1', balance: 100 } as any);
      jest
        .spyOn(prisma.walletTransaction, 'create')
        .mockResolvedValue({ status: WalletTransactionStatus.PENDING } as any);

      await service.addTransaction({
        ownerType: WalletOwnerType.USER,
        ownerId: 'user-1',
        amount: 50,
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.PENDING,
      } as any);

      expect(prisma.wallet.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateWallet', () => {
    it('should create if missing or return existing wallet', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-1' } as any);

      const result = await service.getOrCreateWallet(
        WalletOwnerType.USER,
        'user-1',
      );
      expect(result.id).toBe('wallet-1');
    });

    it('should create wallet if upsert resolves new', async () => {
      jest
        .spyOn(prisma.wallet, 'upsert')
        .mockResolvedValue({ id: 'wallet-new' } as any);

      const result = await service.getOrCreateWallet(
        WalletOwnerType.USER,
        'user-1',
      );
      expect(result.id).toBe('wallet-new');
      expect(prisma.wallet.upsert).toHaveBeenCalled();
    });
  });

  describe('getWalletTransactions', () => {
    it('should return paginated transactions', async () => {
      jest.spyOn(prisma.walletTransaction, 'count').mockResolvedValue(2);
      jest
        .spyOn(prisma.walletTransaction, 'findMany')
        .mockResolvedValue([{ id: 'tx-1' }, { id: 'tx-2' }] as any);

      const result = await service.getWalletTransactions('wallet-1', {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      // result is an array
    });
  });

  describe('getMetrics', () => {
    it('should return aggregated wallet metrics', async () => {
      jest.spyOn(prisma.wallet, 'count').mockResolvedValue(10);
      jest
        .spyOn(prisma.wallet, 'aggregate')
        .mockResolvedValue({ _sum: { balance: 100 } } as any);

      const result = await service.getMetrics();

      expect(result.totalCompanyWallets).toBeDefined();
      expect(result.totalLiabilitiesUsd).toBeDefined();
    });
  });
});
