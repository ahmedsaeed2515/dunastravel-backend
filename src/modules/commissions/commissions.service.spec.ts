import { Test, TestingModule } from '@nestjs/testing';
import { CommissionsService } from './commissions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import {
  CommissionStatus,
  BookingStatus,
  CompanyStatus,
  Prisma,
  WalletOwnerType,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CommissionsService', () => {
  let service: CommissionsService;
  let prisma: any;
  let walletsService: any;

  beforeEach(async () => {
    prisma = {
      commission: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
      },
      walletTransaction: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    walletsService = {
      addTransaction: jest.fn().mockResolvedValue({ id: 'tx-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletsService, useValue: walletsService },
      ],
    }).compile();

    service = module.get<CommissionsService>(CommissionsService);
  });

  describe('createCommission', () => {
    const bookingId = 'booking-uuid-1';
    const companyId = 'company-uuid-1';

    it('should throw BadRequestException if commission already exists for booking', async () => {
      prisma.commission.findUnique.mockResolvedValue({ id: 'comm-1' });

      await expect(
        service.createCommission({
          bookingId,
          companyId,
          rate: 10,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking not found', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue(null);
      prisma.company.findUnique.mockResolvedValue({
        commissionRate: new Prisma.Decimal(10),
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      });

      await expect(
        service.createCommission({
          bookingId,
          companyId,
          rate: 10,
          amount: 100,
        }),
      ).rejects.toThrow('Booking not found');
    });

    it('should throw BadRequestException if booking status is not eligible', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        totalAmountUsd: new Prisma.Decimal(1000),
        companyId,
        status: BookingStatus.PENDING,
        deletedAt: null,
      });
      prisma.company.findUnique.mockResolvedValue({
        commissionRate: new Prisma.Decimal(10),
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      });

      await expect(
        service.createCommission({
          bookingId,
          companyId,
          rate: 10,
          amount: 100,
        }),
      ).rejects.toThrow(
        'The booking is not eligible for this company commission',
      );
    });

    it('should throw BadRequestException if company is inactive or deleted', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        totalAmountUsd: new Prisma.Decimal(1000),
        companyId,
        status: BookingStatus.CONFIRMED,
        deletedAt: null,
      });
      prisma.company.findUnique.mockResolvedValue({
        commissionRate: new Prisma.Decimal(10),
        status: CompanyStatus.SUSPENDED,
        deletedAt: null,
      });

      await expect(
        service.createCommission({
          bookingId,
          companyId,
          rate: 10,
          amount: 100,
        }),
      ).rejects.toThrow('The company is not eligible to receive commissions');
    });

    it('should throw BadRequestException if submitted amount does not match server calculation', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        totalAmountUsd: new Prisma.Decimal(1000),
        companyId,
        status: BookingStatus.CONFIRMED,
        deletedAt: null,
      });
      prisma.company.findUnique.mockResolvedValue({
        commissionRate: new Prisma.Decimal(10),
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      });

      // expected is 1000 * 10% = 100. Submitting 150 must fail.
      await expect(
        service.createCommission({
          bookingId,
          companyId,
          rate: 10,
          amount: 150,
        }),
      ).rejects.toThrow(
        'Commission terms do not match the server-calculated value',
      );
    });

    it('should successfully create PENDING commission when terms match', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        totalAmountUsd: new Prisma.Decimal(1000),
        companyId,
        status: BookingStatus.CONFIRMED,
        deletedAt: null,
      });
      prisma.company.findUnique.mockResolvedValue({
        commissionRate: new Prisma.Decimal(10),
        status: CompanyStatus.ACTIVE,
        deletedAt: null,
      });
      prisma.commission.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'comm-new', ...args.data }),
      );

      const result = await service.createCommission({
        bookingId,
        companyId,
        rate: 10,
        amount: 100,
      });

      expect(result.status).toBe(CommissionStatus.PENDING);
      expect(result.amount.toString()).toBe('100');
      expect(result.rate.toString()).toBe('10');
      expect(prisma.commission.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateCommissionStatus', () => {
    const commissionId = 'comm-uuid-1';

    it('should throw NotFoundException if commission does not exist', async () => {
      prisma.commission.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCommissionStatus(commissionId, {
          status: CommissionStatus.APPROVED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return idempotently if commission status is unchanged', async () => {
      const existing = {
        id: commissionId,
        status: CommissionStatus.PENDING,
      };
      prisma.commission.findUnique.mockResolvedValue(existing);

      const result = await service.updateCommissionStatus(commissionId, {
        status: CommissionStatus.PENDING,
      });

      expect(result).toBe(existing);
      expect(prisma.commission.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid status transition', async () => {
      const existing = {
        id: commissionId,
        status: CommissionStatus.CANCELLED,
      };
      prisma.commission.findUnique.mockResolvedValue(existing);

      await expect(
        service.updateCommissionStatus(commissionId, {
          status: CommissionStatus.APPROVED,
        }),
      ).rejects.toThrow(
        'Commission cannot transition from CANCELLED to APPROVED',
      );
    });

    it('should transition PENDING -> APPROVED and credit partner wallet', async () => {
      const existing = {
        id: commissionId,
        companyId: 'company-1',
        bookingId: 'booking-1',
        amount: new Prisma.Decimal(150),
        status: CommissionStatus.PENDING,
      };
      prisma.commission.findUnique.mockResolvedValue(existing);
      prisma.commission.update.mockResolvedValue({
        ...existing,
        status: CommissionStatus.APPROVED,
      });
      // Mock findUnique inside processCommissionApproval returning APPROVED commission
      prisma.commission.findUnique
        .mockResolvedValueOnce(existing) // initial check
        .mockResolvedValueOnce({
          ...existing,
          status: CommissionStatus.APPROVED,
        }); // processCommissionApproval check
      prisma.walletTransaction.findFirst.mockResolvedValue(null); // not already credited

      const result = await service.updateCommissionStatus(commissionId, {
        status: CommissionStatus.APPROVED,
      });

      expect(result.status).toBe(CommissionStatus.APPROVED);
      expect(walletsService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerType: WalletOwnerType.COMPANY,
          ownerId: 'company-1',
          amount: 150,
          type: WalletTransactionType.CREDIT,
          referenceType: 'COMMISSION',
          referenceId: commissionId,
        }),
      );
    });

    it('should transition APPROVED -> CANCELLED and reverse wallet credit', async () => {
      const existing = {
        id: commissionId,
        companyId: 'company-1',
        bookingId: 'booking-1',
        amount: new Prisma.Decimal(150),
        status: CommissionStatus.APPROVED,
      };
      prisma.commission.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: CommissionStatus.CANCELLED,
        });
      prisma.commission.update.mockResolvedValue({
        ...existing,
        status: CommissionStatus.CANCELLED,
      });
      // was credited = true, existing reversal = null
      prisma.walletTransaction.findFirst
        .mockResolvedValueOnce({ id: 'credit-tx' }) // wasCredited
        .mockResolvedValueOnce(null); // existingReversal

      const result = await service.updateCommissionStatus(commissionId, {
        status: CommissionStatus.CANCELLED,
      });

      expect(result.status).toBe(CommissionStatus.CANCELLED);
      expect(walletsService.addTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerType: WalletOwnerType.COMPANY,
          ownerId: 'company-1',
          amount: 150,
          type: WalletTransactionType.DEBIT,
          referenceType: 'COMMISSION_REVERSAL',
          referenceId: commissionId,
        }),
      );
    });

    it('should NOT debit wallet when transitioning PENDING -> CANCELLED (never credited)', async () => {
      const existing = {
        id: commissionId,
        companyId: 'company-1',
        bookingId: 'booking-1',
        amount: new Prisma.Decimal(150),
        status: CommissionStatus.PENDING,
      };
      prisma.commission.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: CommissionStatus.CANCELLED,
        });
      prisma.commission.update.mockResolvedValue({
        ...existing,
        status: CommissionStatus.CANCELLED,
      });

      const result = await service.updateCommissionStatus(commissionId, {
        status: CommissionStatus.CANCELLED,
      });

      expect(result.status).toBe(CommissionStatus.CANCELLED);
      expect(walletsService.addTransaction).not.toHaveBeenCalled();
    });
  });

  describe('calculateAndRecordCommission', () => {
    it('should return null if booking has no company', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        companyId: null,
      });

      const res = await service.calculateAndRecordCommission('b1');
      expect(res).toBeNull();
    });

    it('should return existing commission if already created', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        companyId: 'c1',
        company: {
          id: 'c1',
          status: CompanyStatus.ACTIVE,
          commissionRate: new Prisma.Decimal(10),
          deletedAt: null,
        },
      });
      const existing = { id: 'comm-exist' };
      prisma.commission.findUnique.mockResolvedValue(existing);

      const res = await service.calculateAndRecordCommission('b1');
      expect(res).toBe(existing);
    });

    it('should calculate rate and record commission if none exists', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        companyId: 'c1',
        totalAmountUsd: new Prisma.Decimal(2000),
        company: {
          id: 'c1',
          status: CompanyStatus.ACTIVE,
          commissionRate: new Prisma.Decimal(15),
          deletedAt: null,
        },
      });
      prisma.commission.findUnique.mockResolvedValue(null);
      prisma.commission.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'new-comm', ...args.data }),
      );

      const res = await service.calculateAndRecordCommission('b1');
      expect(res).not.toBeNull();
      expect(res!.amount.toString()).toBe('300'); // 2000 * 15% = 300
      expect(res!.status).toBe(CommissionStatus.PENDING);
    });
  });

  describe('findAll and getMetrics', () => {
    it('should list commissions with pagination and meta', async () => {
      prisma.commission.findMany.mockResolvedValue([
        {
          id: 'c1',
          amount: new Prisma.Decimal(100),
          rate: new Prisma.Decimal(10),
          status: CommissionStatus.PENDING,
          booking: {
            referenceCode: 'BK-100',
            totalAmountUsd: new Prisma.Decimal(1000),
            invoice: { invoiceNumber: 'INV-1' },
          },
          company: { name: 'Acme Travels', referenceCode: 'ACME' },
        },
      ]);
      prisma.commission.count.mockResolvedValue(1);

      const res = await service.findAll({ page: 1, limit: 10 });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].booking.referenceCode).toBe('BK-100');
      expect(res.meta.total).toBe(1);
      expect(res.meta.totalPages).toBe(1);
    });

    it('should aggregate commission metrics', async () => {
      prisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(500) } }) // pending
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(2500) } }); // approved
      prisma.commission.count.mockResolvedValue(4);

      const metrics = await service.getMetrics();
      expect(metrics.totalPendingUsd).toBe(500);
      expect(metrics.totalApprovedUsd).toBe(2500);
      expect(metrics.pendingCount).toBe(4);
    });
  });
});
