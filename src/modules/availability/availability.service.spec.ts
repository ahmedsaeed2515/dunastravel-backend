import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AvailabilityService - releaseExpiredHolds', () => {
  let service: AvailabilityService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      booking: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      tour: { findUnique: jest.fn(), findFirst: jest.fn() },
      tourAvailability: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prismaMock)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  it('should release capacity and cancel expired pending bookings transactionally', async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      { id: 'b1', availabilityId: 'a1', adults: 2, children: 1, status: 'PENDING' },
    ]);
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });

    const releasedCount = await service.releaseExpiredHolds(15);

    expect(releasedCount).toBe(1);
    expect(prismaMock.booking.findMany).toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('should not double-release if updateMany count is 0', async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      { id: 'b2', availabilityId: 'a2', adults: 1, children: 0, status: 'PENDING' },
    ]);
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

    const releasedCount = await service.releaseExpiredHolds(15);

    expect(releasedCount).toBe(0);
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it('creates a slot with the explicitly requested capacity instead of a business default', async () => {
    const date = '2026-11-01';
    const created = { id: 'availability-1', totalCapacity: 47, remainingSeats: 47 };
    prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
    prismaMock.tourAvailability.findUnique.mockResolvedValue(null);
    prismaMock.tourAvailability.create.mockResolvedValue(created);

    await expect(
      service.createAvailability('tour-1', date, 47, 'AVAILABLE', {
        id: 'admin-1',
        role: 'ADMIN',
      } as any),
    ).resolves.toEqual(created);

    expect(prismaMock.tourAvailability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tourId: 'tour-1',
        totalCapacity: 47,
        remainingSeats: 47,
        status: 'AVAILABLE',
      }),
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'TOUR_AVAILABILITY_CREATED' }),
    });
  });

  it('does not overwrite existing capacity when a batch includes duplicate dates', async () => {
    prismaMock.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
    prismaMock.tourAvailability.createMany.mockResolvedValue({ count: 1 });

    await expect(
      service.createBatchAvailability('tour-1', '2026-11-01', '2026-11-02', 55),
    ).resolves.toEqual({ count: 1 });

    expect(prismaMock.tourAvailability.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(prismaMock.tourAvailability).not.toHaveProperty('upsert');
  });

  it('rejects a stale availability update before changing capacity', async () => {
    prismaMock.tourAvailability.findUnique.mockResolvedValue({
      id: 'availability-1',
      totalCapacity: 20,
      remainingSeats: 10,
      status: 'LIMITED',
      updatedAt: new Date('2026-10-10T00:00:00.000Z'),
    });

    await expect(
      service.updateAvailability('availability-1', {
        totalCapacity: 25,
        expectedUpdatedAt: '2026-10-09T00:00:00.000Z',
      }),
    ).rejects.toThrow('changed by another user');
    expect(prismaMock.tourAvailability.update).not.toHaveBeenCalled();
  });

  it('keeps reserved seats intact while making new capacity available', async () => {
    prismaMock.tourAvailability.findUnique.mockResolvedValue({
      id: 'availability-1',
      totalCapacity: 20,
      remainingSeats: 5,
      status: 'LIMITED',
      updatedAt: new Date('2026-10-10T00:00:00.000Z'),
    });
    prismaMock.tourAvailability.update.mockResolvedValue({ id: 'availability-1' });

    await service.updateAvailability('availability-1', { totalCapacity: 30 });

    expect(prismaMock.tourAvailability.update).toHaveBeenCalledWith({
      where: { id: 'availability-1' },
      data: { totalCapacity: 30, remainingSeats: 15, status: 'AVAILABLE' },
    });
  });

  it('refuses deletion when a slot has booking history', async () => {
    prismaMock.tourAvailability.findUnique.mockResolvedValue({
      id: 'availability-1',
      tourId: 'tour-1',
      date: new Date('2026-11-01T00:00:00.000Z'),
    });
    prismaMock.booking.count.mockResolvedValue(1);

    await expect(service.deleteAvailability('availability-1')).rejects.toThrow(
      'booking history',
    );
    expect(prismaMock.tourAvailability.delete).not.toHaveBeenCalled();
  });
});
