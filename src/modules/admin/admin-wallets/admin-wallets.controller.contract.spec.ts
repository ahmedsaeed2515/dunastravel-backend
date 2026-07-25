import { Test, TestingModule } from '@nestjs/testing';
import { AdminWalletsController } from './admin-wallets.controller';
import { AdminWalletsService } from './admin-wallets.service';
import { BadRequestException } from '@nestjs/common';

describe('AdminWalletsController Contract Tests', () => {
  let controller: AdminWalletsController;
  let service: jest.Mocked<AdminWalletsService>;

  const mockWallet = {
    id: 'wlt-1',
    ownerType: 'COMPANY',
    ownerId: 'cmp-1',
    balance: '500.00',
    balanceUsd: '500.00',
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest
        .fn()
        .mockResolvedValue({ data: [mockWallet], meta: { total: 1 } }),
      getTransactions: jest
        .fn()
        .mockResolvedValue({ data: [], meta: { total: 0 } }),
      addManualTransaction: jest.fn().mockResolvedValue({
        id: 'tx-1',
        walletId: 'wlt-1',
        amount: '100.00',
        type: 'CREDIT',
        amountUsd: '100.00',
        balanceUsd: '600.00',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWalletsController],
      providers: [
        {
          provide: AdminWalletsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminWalletsController>(AdminWalletsController);
    service = module.get(AdminWalletsService);
  });

  it('POST /api/admin/wallets/:id/transactions adds manual transaction atomically', async () => {
    const dto = {
      amount: 100,
      type: 'CREDIT' as any,
      reason: 'Manual adjustment',
    };
    const user = { id: 'admin-1' };
    const res = await controller.addTransaction('wlt-1', dto, user);
    expect(res).toBeDefined();
    expect(service.addManualTransaction).toHaveBeenCalledWith(
      'wlt-1',
      dto,
      'admin-1',
    );
  });

  it('POST /api/admin/wallets/:id/transactions rejects negative balance on debit', async () => {
    service.addManualTransaction.mockRejectedValueOnce(
      new BadRequestException(
        'Insufficient wallet balance for debit transaction',
      ),
    );
    const dto = {
      amount: 1000,
      type: 'DEBIT' as any,
      reason: 'Overdraft attempt',
    };

    await expect(
      controller.addTransaction('wlt-1', dto, { id: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});
