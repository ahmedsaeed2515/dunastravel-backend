import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MediaEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../../common/storage/storage-provider.interface';
import { MediaService } from './media.service';

const imageFile = {
  originalname: 'asset.webp',
  mimetype: 'image/webp',
  size: 1024,
  buffer: Buffer.from('image'),
};
const uploadedAsset = {
  success: true,
  publicId: 'provider/asset-1',
  url: 'https://provider.example/asset-1.webp',
  secureUrl: 'https://provider.example/asset-1.webp',
  format: 'webp',
  bytes: 1024,
  width: 800,
  height: 600,
  error: null,
};

describe('MediaService upload integrity', () => {
  const createService = (prisma: object, storage: object) =>
    new MediaService(
      prisma as PrismaService,
      storage as StorageProvider,
      { get: jest.fn().mockReturnValue(10 * 1024 * 1024) } as unknown as ConfigService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

  it('creates a general asset only after a successful provider response', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'media-1',
      ...uploadedAsset,
      entityType: MediaEntityType.GENERAL,
      entityId: null,
      provenance: 'UPLOADED',
      altText: 'Alt',
      uploadedBy: 'admin-1',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      providerName: 'cloudinary',
      mimeType: 'image/webp',
    });
    const transaction = jest.fn(async (callback) => callback({ mediaAsset: { create }, auditLog: { create: jest.fn() } }));
    const service = createService(
      { mediaAsset: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: transaction },
      { upload: jest.fn().mockResolvedValue(uploadedAsset), delete: jest.fn() },
    );

    const result = await service.uploadAsset(imageFile, { entityType: MediaEntityType.GENERAL, entityId: null, altText: 'Alt' }, 'admin-1');

    expect(result.id).toBe('media-1');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entityId: null, entityType: MediaEntityType.GENERAL }) }));
  });

  it('does not persist when the provider fails after its retry budget', async () => {
    const upload = jest.fn().mockResolvedValue({ success: false, error: 'timeout' });
    const service = createService({ mediaAsset: { findUnique: jest.fn() } }, { upload, delete: jest.fn() });

    await expect(service.uploadAsset(imageFile, { entityType: MediaEntityType.GENERAL, entityId: null, altText: undefined }, 'admin-1')).rejects.toBeInstanceOf(HttpException);
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it('rejects a provider response that is missing a secure object and does not persist it', async () => {
    const transaction = jest.fn();
    const service = createService(
      { mediaAsset: { findUnique: jest.fn() }, $transaction: transaction },
      { upload: jest.fn().mockResolvedValue({ ...uploadedAsset, secureUrl: '' }), delete: jest.fn() },
    );

    await expect(service.uploadAsset(imageFile, { entityType: MediaEntityType.GENERAL, entityId: null, altText: undefined }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a duplicate provider ID before it can create a second MediaAsset', async () => {
    const transaction = jest.fn();
    const service = createService(
      { mediaAsset: { findUnique: jest.fn().mockResolvedValue({ id: 'existing-asset' }) }, $transaction: transaction },
      { upload: jest.fn().mockResolvedValue(uploadedAsset), delete: jest.fn() },
    );

    await expect(service.uploadAsset(imageFile, { entityType: MediaEntityType.GENERAL, entityId: null, altText: undefined }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects media exceeding the configured size before a provider call', async () => {
    const upload = jest.fn();
    const service = createService({}, { upload, delete: jest.fn() });
    const tooLargeFile = { ...imageFile, size: 10 * 1024 * 1024 + 1 };

    await expect(service.uploadAsset(tooLargeFile, { entityType: MediaEntityType.GENERAL, entityId: null, altText: undefined }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(upload).not.toHaveBeenCalled();
  });
});
