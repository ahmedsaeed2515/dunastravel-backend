import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('UserService - Customer 360 CRM', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customerNote: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customerDocument: {
        create: jest.fn(),
      },
      customerActivityLog: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      tailorMadeInquiry: {
        findMany: jest.fn(),
      },
      userEvent: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('findCustomersCrm - Financial Ledger Precision', () => {
    it('calculates totalSpent and totalPaid accurately, excluding cancelled bookings and non-captured payments', async () => {
      const mockCustomer = {
        id: 'cust-uuid-1',
        customerNumber: 'CUST-2026-0001',
        name: 'Sir Arthur Conan',
        email: 'arthur@luxury.co.uk',
        phone: '+44 7700 900077',
        isVip: true,
        status: 'ACTIVE',
        tags: ['VIP', 'Repeat'],
        segments: ['Luxury Leisure'],
        nationality: 'British',
        createdAt: new Date('2026-01-10'),
        bookings: [
          // 1. Paid booking: Total $5,000, captured payment $5,000 -> Counts $5,000 totalSpent & $5,000 totalPaid
          {
            totalAmountUsd: new Prisma.Decimal(5000),
            status: 'PAID',
            payments: [
              {
                amount: new Prisma.Decimal(5000),
                isRefund: false,
                status: 'CAPTURED',
              },
            ],
          },
          // 2. Confirmed booking: Total $3,000, captured partial payment $1,000, failed payment $2,000
          // -> Counts $3,000 totalSpent, only $1,000 totalPaid
          {
            totalAmountUsd: new Prisma.Decimal(3000),
            status: 'CONFIRMED',
            payments: [
              {
                amount: new Prisma.Decimal(1000),
                isRefund: false,
                status: 'CAPTURED',
              },
              {
                amount: new Prisma.Decimal(2000),
                isRefund: false,
                status: 'FAILED',
              }, // MUST BE EXCLUDED
            ],
          },
          // 3. Cancelled booking: Total $4,000 with full refund -> EXCLUDED from totalSpent, net payment is 0
          {
            totalAmountUsd: new Prisma.Decimal(4000),
            status: 'CANCELLED',
            payments: [
              {
                amount: new Prisma.Decimal(4000),
                isRefund: false,
                status: 'CAPTURED',
              },
              {
                amount: new Prisma.Decimal(4000),
                isRefund: true,
                status: 'CAPTURED',
              },
            ],
          },
          // 4. Pending booking draft: Total $2,500 -> MUST BE EXCLUDED from totalSpent and totalPaid
          {
            totalAmountUsd: new Prisma.Decimal(2500),
            status: 'PENDING',
            payments: [
              {
                amount: new Prisma.Decimal(2500),
                isRefund: false,
                status: 'PENDING',
              }, // MUST BE EXCLUDED
            ],
          },
        ],
        _count: {
          bookings: 4,
          customerNotes: 2,
          customerDocuments: 1,
        },
      };

      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([mockCustomer]);

      const result = await service.findCustomersCrm(
        { page: 1, limit: 10 },
        'admin-1',
      );

      expect(result.data).toHaveLength(1);
      const customer = result.data[0];
      // Expected totalSpent: 5000 (PAID) + 3000 (CONFIRMED) = 8000
      expect(customer.totalSpent).toBe(8000);
      // Expected totalPaid: 5000 + 1000 + (4000 - 4000) = 6000
      // Expected outstandingBalance: 8000 - 6000 = 2000
      expect(customer.outstandingBalance).toBe(2000);
      expect(customer.isVip).toBe(true);
      expect(customer.bookingsCount).toBe(4);
    });
  });

  describe('addCustomerNote', () => {
    it('creates an internal customer note and logs an audit trail', async () => {
      const customerId = 'cust-uuid-2';
      prisma.user.findFirst.mockResolvedValue({
        id: customerId,
        name: 'Client Two',
      });
      prisma.customerNote.create.mockResolvedValue({
        id: 'note-1',
        userId: customerId,
        content: 'Client requested VIP airport meet & greet.',
        category: 'OPERATIONS',
        authorId: 'admin-1',
        createdAt: new Date(),
        user: { name: 'Admin Staff' },
      });

      const note = await service.addCustomerNote(
        customerId,
        {
          content: 'Client requested VIP airport meet & greet.',
          noteType: 'INTERNAL',
        },
        'admin-1',
      );

      expect(note.id).toBe('note-1');
      expect(prisma.customerNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId,
          userId: 'admin-1',
          content: expect.stringContaining('Client requested VIP airport meet'),
        }),
        include: { user: { select: { name: true } } },
      });
      expect(prisma.customerActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId,
          userId: 'admin-1',
          action: 'NOTE_ADDED',
        }),
      });
    });
  });

  describe('bulkUpdateCustomers', () => {
    it('applies bulk tags, status, and VIP modifications across multiple customers', async () => {
      const userIds = ['cust-1', 'cust-2'];
      prisma.user.updateMany.mockResolvedValue({ count: 2 });
      prisma.user.findMany.mockResolvedValue([
        { id: 'cust-1' },
        { id: 'cust-2' },
      ]);

      const res = await service.bulkUpdateCustomers(
        {
          userIds,
          isVip: true,
          status: 'ACTIVE',
        },
        'admin-1',
      );

      expect(res).toEqual({ count: 2 });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { in: userIds },
        }),
        data: expect.objectContaining({
          isVip: true,
          status: 'ACTIVE',
        }),
      });
      expect(prisma.customerActivityLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'cust-1',
            action: 'BULK_UPDATE',
          }),
          expect.objectContaining({
            customerId: 'cust-2',
            action: 'BULK_UPDATE',
          }),
        ]),
      });
    });
  });
});
