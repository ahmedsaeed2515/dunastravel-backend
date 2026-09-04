import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MediaEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../../common/storage/storage-provider.interface';
import { MediaService } from './media.service';

describe('MediaService public gallery', () => {
  it('returns only active general assets and caps the public result size', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new MediaService(
      { mediaAsset: { findMany } } as unknown as PrismaService,
      {} as StorageProvider,
      {} as ConfigService,
      {} as EventEmitter2,
    );

    await service.getPublicGallery(500);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: MediaEntityType.GENERAL,
        deletedAt: null,
        NOT: {
          entityId: { in: ['transport', 'fleet', 'transportation'] },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('filters by transport category matching transport and fleet entity IDs', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new MediaService(
      { mediaAsset: { findMany } } as unknown as PrismaService,
      {} as StorageProvider,
      {} as ConfigService,
      {} as EventEmitter2,
    );

    await service.getPublicGallery(50, 'transport');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        entityType: MediaEntityType.GENERAL,
        entityId: { in: ['transport', 'fleet', 'transportation'] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });
});
