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
      },
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
});
