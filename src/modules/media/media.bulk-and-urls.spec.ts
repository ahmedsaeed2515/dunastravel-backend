import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MediaEntityType, MediaProvenance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../../common/storage/storage-provider.interface';
import { MediaService } from './media.service';
import { BadRequestException } from '@nestjs/common';

describe('MediaService Bulk Upload & URL Import', () => {
  let mediaService: MediaService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockConfig: any;
  let mockEvents: any;

  beforeEach(() => {
    mockPrisma = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      tour: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tour-1' }),
      },
      hotel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'hotel-1' }),
      },
      tourImage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockStorage = {
      upload: jest.fn().mockResolvedValue({
        success: true,
        publicId: 'dunas-travel/test-img',
        url: 'http://res.cloudinary.com/test/image/upload/v1/test-img.webp',
        secureUrl: 'https://res.cloudinary.com/test/image/upload/v1/test-img.webp',
        format: 'webp',
        bytes: 1024,
        width: 800,
        height: 600,
        error: null,
      }),
      uploadUrl: jest.fn().mockResolvedValue({
        success: true,
        publicId: 'dunas-travel/test-url-img',
        url: 'http://res.cloudinary.com/test/image/upload/v1/test-url-img.webp',
        secureUrl: 'https://res.cloudinary.com/test/image/upload/v1/test-url-img.webp',
        format: 'webp',
        bytes: 2048,
        width: 1200,
        height: 800,
        error: null,
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      getDeliveryUrl: jest.fn().mockResolvedValue('https://res.cloudinary.com/test/img.webp'),
    };

    mockConfig = {
      get: jest.fn((key) => {
        if (key === 'storage.maxFileSizeBytes') return 10 * 1024 * 1024;
        if (key === 'storage.uploadFolder') return 'dunas-travel';
        return undefined;
      }),
    };

    mockEvents = {
      emit: jest.fn(),
    };

    mediaService = new MediaService(
      mockPrisma as unknown as PrismaService,
      mockStorage as StorageProvider,
      mockConfig as ConfigService,
      mockEvents as EventEmitter2,
    );
  });

  describe('importMediaUrls', () => {
    it('throws BadRequestException if no URLs provided', async () => {
      await expect(
        mediaService.importMediaUrls(
          { items: [], entityType: MediaEntityType.GENERAL },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully imports multiple valid URLs and creates MediaAssets', async () => {
      mockPrisma.mediaAsset.create.mockResolvedValueOnce({
        id: 'asset-1',
        publicId: 'dunas-travel/test-url-img-1',
        url: 'http://res.cloudinary.com/test/img1.webp',
        secureUrl: 'https://res.cloudinary.com/test/img1.webp',
        providerName: 'cloudinary',
        format: 'webp',
        mimeType: 'image/webp',
        bytes: 2048,
        width: 1200,
        height: 800,
        entityType: MediaEntityType.GENERAL,
        entityId: 'destinations',
        provenance: MediaProvenance.UPLOADED,
        altText: 'Giza Pyramids',
        uploadedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await mediaService.importMediaUrls(
        {
          items: [
            {
              url: 'https://images.unsplash.com/photo-pyramids.jpg',
              altText: 'Giza Pyramids',
            },
          ],
          entityType: MediaEntityType.GENERAL,
          categorySlug: 'destinations',
        },
        'user-1',
      );

      expect(mockStorage.uploadUrl).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(mockEvents.emit).toHaveBeenCalled();
    });
  });

  describe('uploadBulkAssets', () => {
    it('throws BadRequestException if no files provided', async () => {
      await expect(
        mediaService.uploadBulkAssets(
          [],
          { entityType: MediaEntityType.GENERAL },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully processes multiple files', async () => {
      mockPrisma.mediaAsset.create.mockResolvedValue({
        id: 'asset-bulk-1',
        publicId: 'dunas-travel/test-img',
        url: 'http://res.cloudinary.com/test/img.webp',
        secureUrl: 'https://res.cloudinary.com/test/img.webp',
        providerName: 'cloudinary',
        format: 'webp',
        mimeType: 'image/jpeg',
        bytes: 1024,
        width: 800,
        height: 600,
        entityType: MediaEntityType.GENERAL,
        entityId: 'general',
        provenance: MediaProvenance.UPLOADED,
        altText: 'Photo 1',
        uploadedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockFile1 = {
        originalname: 'photo1.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake-jpeg-content'),
      };
      const mockFile2 = {
        originalname: 'photo2.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
        buffer: Buffer.from('fake-jpeg-content-2'),
      };

      const result = await mediaService.uploadBulkAssets(
        [mockFile1, mockFile2],
        {
          entityType: MediaEntityType.GENERAL,
          categorySlug: 'general',
          altText: 'General Photo',
        },
        'user-1',
      );

      expect(result).toHaveLength(2);
      expect(mockStorage.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe('listAssets filtering logic', () => {
    it('constructs robust AND clauses when combining category, format and search', async () => {
      mockPrisma.mediaAsset.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.mediaAsset.count = jest.fn().mockResolvedValue(0);

      await mediaService.listAssets({
        category: 'hotels',
        format: 'webp',
        search: 'Hilton',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockPrisma.mediaAsset.findMany).toHaveBeenCalled();
      const calledWhere = mockPrisma.mediaAsset.findMany.mock.calls[0][0].where;

      expect(calledWhere.AND).toBeDefined();
      expect(calledWhere.AND).toEqual(
        expect.arrayContaining([
          { deletedAt: null },
          { entityType: MediaEntityType.HOTEL },
          { format: 'webp' },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { altText: { contains: 'Hilton', mode: 'insensitive' } },
              { publicId: { contains: 'Hilton', mode: 'insensitive' } },
            ]),
          }),
        ]),
      );
    });
  });
});

