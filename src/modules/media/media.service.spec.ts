import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MediaEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../../common/storage/storage-provider.interface';
import { MediaService } from './media.service';

describe('MediaService entity ownership', () => {
  const createService = (prisma: Partial<PrismaService>) =>
    new MediaService(
      prisma as PrismaService,
      {} as StorageProvider,
      {} as ConfigService,
      {} as EventEmitter2,
    );

  it('serves hotel assets only when the hotel is published and active', async () => {
    const hotelFindFirst = jest.fn().mockResolvedValue({ id: 'hotel-1' });
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      hotel: { findFirst: hotelFindFirst } as unknown as PrismaService['hotel'],
      mediaAsset: { findMany } as unknown as PrismaService['mediaAsset'],
    });

    await service.getAssetsByHotelId('hotel-1');

    expect(hotelFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'hotel-1',
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: MediaEntityType.HOTEL,
        entityId: 'hotel-1',
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('reports totals from persisted, non-deleted assets', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValue({ _count: { id: 4 }, _sum: { bytes: 1200 } });
    const groupBy = jest.fn().mockResolvedValue([
      { entityType: MediaEntityType.GENERAL, _count: { id: 2 } },
      { entityType: MediaEntityType.HOTEL, _count: { id: 2 } },
    ]);
    const service = createService({
      mediaAsset: {
        aggregate,
        groupBy,
      } as unknown as PrismaService['mediaAsset'],
    });

    await expect(service.getSummary()).resolves.toEqual({
      total: 4,
      bytes: 1200,
      byEntityType: { TOUR: 0, HOTEL: 2, GENERAL: 2 },
    });
  });
});
