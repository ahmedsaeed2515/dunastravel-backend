import * as fs from 'fs';
import {
  Injectable,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types';

import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StorageProvider,
  UploadOptions,
  UploadableFile,
  EagerTransform,
} from '../../common/storage/storage-provider.interface';
import { STORAGE_PROVIDER } from '../../common/storage/storage-provider.token';
import { Prisma, MediaEntityType, MediaProvenance } from '@prisma/client';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UploadBulkMediaDto } from './dto/upload-bulk-media.dto';
import { ImportMediaUrlsDto } from './dto/import-media-urls.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { BulkMoveMediaDto } from './dto/bulk-move-media.dto';
import { CreateMediaCategoryDto, UpdateMediaCategoryDto } from './dto/media-category.dto';
import { ListMediaDto } from './dto/list-media.dto';
import { DeleteMediaResponseDto } from './dto/delete-media-response.dto';
import { IMediaAsset } from './interfaces/media-asset.interface';
import {
  MEDIA_UPLOADED_EVENT,
  MediaUploadedEvent,
} from './interfaces/media-events.interface';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';
import {
  AssignToShowcaseDto,
  UpdateShowcaseItemDto,
  ReorderShowcaseDto,
  OptimizeAssetDto,
  HomepageMediaShowcaseResponseDto,
  ShowcasePhotoItemDto,
  ShowcaseVideoItemDto,
} from './dto/showcase-media.dto';

export interface MediaCategoryItem {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  color?: string;
  icon?: string;
  description?: string;
  isSystem?: boolean;
  count?: number;
}

const DEFAULT_CATEGORIES: MediaCategoryItem[] = [
  {
    id: 'general',
    slug: 'general',
    nameEn: 'General Library',
    nameAr: 'المكتبة العامة',
    color: 'amber',
    icon: 'Folder',
    description: 'General media assets, brand graphics, and unclassified images',
    isSystem: true,
  },
  {
    id: 'tours',
    slug: 'tours',
    nameEn: 'Tours & Excursions',
    nameAr: 'الرحلات والجولات',
    color: 'sky',
    icon: 'Compass',
    description: 'Tour gallery photos, day-by-day itinerary images, and excursion highlights',
    isSystem: true,
  },
  {
    id: 'hotels',
    slug: 'hotels',
    nameEn: 'Hotels & Accommodations',
    nameAr: 'الفنادق والإقامة',
    color: 'violet',
    icon: 'Hotel',
    description: 'Luxury hotel exterior, interior, suites, rooms, and resort amenities',
    isSystem: true,
  },
  {
    id: 'destinations',
    slug: 'destinations',
    nameEn: 'Destinations & Landmarks',
    nameAr: 'الوجهات والمعالم',
    color: 'emerald',
    icon: 'MapPin',
    description: 'Pyramids, Bosphorus, Dead Sea, Petra, Dubai Burj, and world landmarks',
    isSystem: false,
  },
  {
    id: 'hero-covers',
    slug: 'hero-covers',
    nameEn: 'Hero Covers & Banners',
    nameAr: 'أغلفة وبانرات الواجهة',
    color: 'rose',
    icon: 'Sparkles',
    description: 'Cinematic high-resolution hero banners and promotional graphics',
    isSystem: false,
  },
  {
    id: 'blog',
    slug: 'blog',
    nameEn: 'Blog & Articles',
    nameAr: 'المقالات والمدونة',
    color: 'indigo',
    icon: 'BookOpen',
    description: 'Travel guides, stories, cultural tips, and blog editorial imagery',
    isSystem: false,
  },
  {
    id: 'transport',
    slug: 'transport',
    nameEn: 'Transportation Fleet',
    nameAr: 'الأسطول والنقل',
    color: 'teal',
    icon: 'Car',
    description: 'VIP Mercedes vans, luxury coaches, airport transfers, and private chauffeurs',
    isSystem: false,
  },
];

const CMS_MEDIA_CATEGORIES_KEY = 'media_categories';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async uploadAsset(
    file: UploadableFile,
    dto: UploadMediaDto,
    uploadedByUserId: string,
  ): Promise<IMediaAsset> {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSizeBytes =
      this.configService.get<number>('storage.maxFileSizeBytes') ||
      10 * 1024 * 1024;

    if (
      !file ||
      !file.mimetype ||
      !allowedMimeTypes.includes(file.mimetype.toLowerCase())
    ) {
      throw new BadRequestException('Unsupported file type');
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File exceeds the maximum allowed size');
    }

    const isEntityMedia =
      dto.entityType === MediaEntityType.TOUR ||
      dto.entityType === MediaEntityType.HOTEL;
    if (isEntityMedia) {
      if (!dto.entityId) {
        throw new BadRequestException(
          `entityId is required for ${dto.entityType.toLowerCase()} media`,
        );
      }
      if (dto.entityType === MediaEntityType.TOUR) {
        const tour = await this.prisma.tour.findFirst({
          where: { id: dto.entityId, deletedAt: null },
          select: { id: true },
        });
        if (!tour) {
          throw new BadRequestException('Target tour does not exist');
        }
      } else {
        const hotel = await this.prisma.hotel.findFirst({
          where: { id: dto.entityId, deletedAt: null },
          select: { id: true },
        });
        if (!hotel) {
          throw new BadRequestException('Target hotel does not exist');
        }
      }
    }

    const targetEntityId = isEntityMedia
      ? dto.entityId
      : (dto.categorySlug || dto.entityId || null);

    this.logger.debug(
      `Upload initiated { entityType: ${dto.entityType}, entityId: ${targetEntityId}, mimeType: ${file.mimetype}, bytes: ${file.size} }`,
    );

    const folder =
      this.configService.get<string>('storage.uploadFolder') || 'dunas-travel';

    const eager: EagerTransform[] = [
      {
        width: 1920,
        crop: 'limit',
        format: 'webp',
        quality: 'auto',
      },
    ];

    const options: UploadOptions = {
      folder,
      entityType: dto.entityType,
      entityId: targetEntityId ?? null,
      altText: sanitizePlainText(dto.altText).slice(0, 255) || null,
      eager,
    };

    let attempt = 0;
    const maxAttempts = 3;
    let result;

    try {
      while (attempt < maxAttempts) {
        result = await this.storageProvider.upload(file, options);
        if (result.success) {
          break;
        }
        attempt++;
        if (attempt < maxAttempts) {
          this.logger.warn(
            `Upload retry { attempt: ${attempt}, error: ${result.error}, entityType: ${dto.entityType} }`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    } finally {
      if (file.path) {
        fs.unlink(file.path, (err) => {
          if (err)
            this.logger.error(
              `Failed to delete temp file ${file.path}: ${err.message}`,
            );
        });
      }
    }

    if (!result || !result.success) {
      this.logger.error(
        `Upload failed after max retries { attempts: ${maxAttempts}, error: ${result?.error} }`,
      );
      throw new HttpException(
        'Media provider is temporarily unavailable',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const safeFormats = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const hasProviderMetadata =
      typeof result.publicId === 'string' &&
      result.publicId.length > 0 &&
      typeof result.url === 'string' &&
      typeof result.secureUrl === 'string' &&
      typeof result.format === 'string' &&
      typeof result.bytes === 'number';
    let outputIsSafe = false;
    try {
      const outputUrl = new URL(hasProviderMetadata ? result.secureUrl : '');
      outputIsSafe =
        hasProviderMetadata &&
        outputUrl.protocol === 'https:' &&
        safeFormats.has(result.format.toLowerCase()) &&
        result.bytes > 0 &&
        result.bytes <= maxSizeBytes &&
        (!result.width ||
          !result.height ||
          (result.width <= 10_000 &&
            result.height <= 10_000 &&
            result.width * result.height <= 40_000_000));
    } catch {
      outputIsSafe = false;
    }
    if (!outputIsSafe) {
      try {
        if (typeof result.publicId === 'string' && result.publicId.length > 0) {
          await this.storageProvider.delete(result.publicId);
        }
      } catch {
        this.logger.error(
          'Invalid uploaded media also failed provider cleanup',
        );
      }
      throw new BadRequestException('Uploaded media failed content validation');
    }

    const existingPublicId = await this.prisma.mediaAsset.findUnique({
      where: { publicId: result.publicId },
      select: { id: true },
    });
    if (existingPublicId) {
      throw new BadRequestException('Provider returned a duplicate media asset');
    }

    // Provider success, now database transaction
    let mediaAsset: IMediaAsset;
    try {
      mediaAsset = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const asset = await tx.mediaAsset.create({
            data: {
              publicId: result.publicId,
              url: result.url,
              secureUrl: result.secureUrl,
              providerName: 'cloudinary',
              format: result.format,
              mimeType: file.mimetype,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
              entityType: dto.entityType,
              entityId: targetEntityId,
              provenance: MediaProvenance.UPLOADED,
              altText: sanitizePlainText(dto.altText).slice(0, 255) || null,
              uploadedBy: uploadedByUserId,
            },
          });

          this.logger.debug(
            `MediaAsset created { id: ${asset.id}, publicId: ${asset.publicId} }`,
          );

          if (dto.entityType === MediaEntityType.TOUR && dto.entityId) {
            const existingImages = await tx.tourImage.findMany({
              where: { tourId: dto.entityId },
              orderBy: { sortOrder: 'desc' },
              take: 1,
            });

            const nextSortOrder =
              existingImages.length > 0 ? existingImages[0].sortOrder + 1 : 0;
            const isHero = nextSortOrder === 0;

            await tx.tourImage.create({
              data: {
                tourId: dto.entityId,
                imageUrl: asset.secureUrl,
                isHero,
                altText: asset.altText,
                sortOrder: nextSortOrder,
              },
            });
            this.logger.debug(`TourImage upserted { tourId: ${dto.entityId} }`);
          }

          await tx.auditLog.create({
            data: {
              actorId: uploadedByUserId,
              action: 'MEDIA_ASSET_UPLOADED',
              entityType: 'MEDIA_ASSET',
              entityId: asset.id,
              metadata: {
                mediaEntityType: dto.entityType,
                mediaEntityId: targetEntityId,
                bytes: result.bytes,
                format: result.format,
              },
            },
          });

          return asset as IMediaAsset;
        },
      );
    } catch (dbError: unknown) {
      const err = dbError as Error;
      this.logger.error(
        `Database transaction failed during upload { error: ${err.message} }`,
      );
      this.logger.warn(
        `Cleaning up orphaned asset on storage provider: ${result.publicId}`,
      );
      try {
        await this.storageProvider.delete(result.publicId);
      } catch (cleanupError: any) {
        this.logger.error(
          `Failed to cleanup orphaned asset ${result.publicId}: ${cleanupError.message}`,
        );
      }
      throw dbError;
    }

    const eventPayload: MediaUploadedEvent = {
      assetId: mediaAsset.id,
      publicId: mediaAsset.publicId,
      entityType: mediaAsset.entityType,
      entityId: mediaAsset.entityId,
      uploadedBy: mediaAsset.uploadedBy,
      url: mediaAsset.secureUrl,
      occurredAt: mediaAsset.createdAt,
    };
    this.eventEmitter.emit(MEDIA_UPLOADED_EVENT, eventPayload);
    this.logger.debug(
      `media.uploaded event emitted { assetId: ${mediaAsset.id} }`,
    );

    return mediaAsset;
  }

  async uploadBulkAssets(
    files: UploadableFile[],
    dto: UploadBulkMediaDto,
    uploadedByUserId: string,
  ): Promise<IMediaAsset[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for bulk upload');
    }

    let altTextMap: Record<string, string> = {};
    if (dto.altText) {
      try {
        if (dto.altText.startsWith('{')) {
          altTextMap = JSON.parse(dto.altText);
        }
      } catch {
        altTextMap = {};
      }
    }

    const uploadedAssets: IMediaAsset[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileAltText =
        altTextMap[file.originalname] ||
        (Object.keys(altTextMap).length === 0 && dto.altText && !dto.altText.startsWith('{')
          ? dto.altText
          : file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));

      try {
        const asset = await this.uploadAsset(
          file,
          {
            entityType: dto.entityType,
            entityId: dto.entityId,
            categorySlug: dto.categorySlug,
            altText: fileAltText,
          },
          uploadedByUserId,
        );
        uploadedAssets.push(asset);
      } catch (err: any) {
        this.logger.error(
          `Failed to upload file in batch (${file.originalname}): ${err.message}`,
        );
        errors.push(`${file.originalname}: ${err.message}`);
      }
    }

    if (uploadedAssets.length === 0 && errors.length > 0) {
      throw new BadRequestException(`Bulk upload failed: ${errors.join(', ')}`);
    }

    return uploadedAssets;
  }

  async importMediaUrls(
    dto: ImportMediaUrlsDto,
    uploadedByUserId: string,
  ): Promise<IMediaAsset[]> {
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('No image URLs provided for import');
    }

    if (dto.items.length > 30) {
      throw new BadRequestException('Maximum 30 URLs can be imported in a single batch');
    }

    const isEntityMedia =
      dto.entityType === MediaEntityType.TOUR ||
      dto.entityType === MediaEntityType.HOTEL;
    if (isEntityMedia) {
      if (!dto.entityId) {
        throw new BadRequestException(
          `entityId is required for ${dto.entityType.toLowerCase()} media`,
        );
      }
      if (dto.entityType === MediaEntityType.TOUR) {
        const tour = await this.prisma.tour.findFirst({
          where: { id: dto.entityId, deletedAt: null },
          select: { id: true },
        });
        if (!tour) {
          throw new BadRequestException('Target tour does not exist');
        }
      } else {
        const hotel = await this.prisma.hotel.findFirst({
          where: { id: dto.entityId, deletedAt: null },
          select: { id: true },
        });
        if (!hotel) {
          throw new BadRequestException('Target hotel does not exist');
        }
      }
    }

    const targetEntityId = isEntityMedia
      ? dto.entityId
      : (dto.categorySlug || dto.entityId || null);

    const folder =
      this.configService.get<string>('storage.uploadFolder') || 'dunas-travel';
    const maxSizeBytes =
      this.configService.get<number>('storage.maxFileSizeBytes') ||
      10 * 1024 * 1024;

    const eager: EagerTransform[] = [
      {
        width: 1920,
        crop: 'limit',
        format: 'webp',
        quality: 'auto',
      },
    ];

    const safeFormats = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const importedAssets: IMediaAsset[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const trimmedUrl = typeof item.url === 'string' ? item.url.trim() : '';
      if (!trimmedUrl || !/^https?:\/\//i.test(trimmedUrl)) {
        errors.push(`Item #${i + 1}: Invalid HTTP/HTTPS image URL format`);
        continue;
      }

      const itemAltText =
        (typeof item.altText === 'string' && item.altText.trim()) ||
        (typeof dto.defaultAltText === 'string' && dto.defaultAltText.trim()) ||
        null;

      const options: UploadOptions = {
        folder,
        entityType: dto.entityType,
        entityId: targetEntityId ?? null,
        altText: itemAltText ? sanitizePlainText(itemAltText).slice(0, 255) : null,
        eager,
      };

      let result;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        result = await this.storageProvider.uploadUrl(trimmedUrl, options);
        if (result.success) break;
        attempt++;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }

      if (!result || !result.success) {
        this.logger.error(
          `URL import failed { url: ${trimmedUrl}, error: ${result?.error} }`,
        );
        errors.push(`URL (${trimmedUrl.slice(0, 40)}...): ${result?.error || 'Provider upload failed'}`);
        continue;
      }

      let outputIsSafe = false;
      try {
        const outputUrl = new URL(result.secureUrl);
        outputIsSafe =
          outputUrl.protocol === 'https:' &&
          safeFormats.has(result.format.toLowerCase()) &&
          result.bytes > 0 &&
          result.bytes <= maxSizeBytes;
      } catch {
        outputIsSafe = false;
      }

      if (!outputIsSafe) {
        try {
          if (result.publicId) await this.storageProvider.delete(result.publicId);
        } catch {
          // Ignore cleanup error
        }
        errors.push(`URL (${trimmedUrl.slice(0, 40)}...): Content validation failed`);
        continue;
      }

      const existing = await this.prisma.mediaAsset.findUnique({
        where: { publicId: result.publicId },
        select: { id: true },
      });
      if (existing) {
        errors.push(`URL (${trimmedUrl.slice(0, 40)}...): Duplicate asset in database`);
        continue;
      }

      try {
        const mimeType = `image/${result.format === 'jpg' ? 'jpeg' : result.format}`;
        const mediaAsset = await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const asset = await tx.mediaAsset.create({
              data: {
                publicId: result.publicId,
                url: result.url,
                secureUrl: result.secureUrl,
                providerName: 'cloudinary',
                format: result.format,
                mimeType,
                bytes: result.bytes,
                width: result.width,
                height: result.height,
                entityType: dto.entityType,
                entityId: targetEntityId,
                provenance: MediaProvenance.UPLOADED,
                altText: options.altText,
                uploadedBy: uploadedByUserId,
              },
            });

            if (dto.entityType === MediaEntityType.TOUR && dto.entityId) {
              const existingImages = await tx.tourImage.findMany({
                where: { tourId: dto.entityId },
                orderBy: { sortOrder: 'desc' },
                take: 1,
              });
              const nextSortOrder =
                existingImages.length > 0 ? existingImages[0].sortOrder + 1 : 0;
              const isHero = nextSortOrder === 0;

              await tx.tourImage.create({
                data: {
                  tourId: dto.entityId,
                  imageUrl: asset.secureUrl,
                  isHero,
                  altText: asset.altText,
                  sortOrder: nextSortOrder,
                },
              });
            }

            await tx.auditLog.create({
              data: {
                actorId: uploadedByUserId,
                action: 'MEDIA_ASSET_IMPORTED_URL',
                entityType: 'MEDIA_ASSET',
                entityId: asset.id,
                metadata: {
                  sourceUrl: trimmedUrl,
                  mediaEntityType: dto.entityType,
                  mediaEntityId: targetEntityId,
                  bytes: result.bytes,
                  format: result.format,
                },
              },
            });

            return asset as IMediaAsset;
          },
        );

        const eventPayload: MediaUploadedEvent = {
          assetId: mediaAsset.id,
          publicId: mediaAsset.publicId,
          entityType: mediaAsset.entityType,
          entityId: mediaAsset.entityId,
          uploadedBy: mediaAsset.uploadedBy,
          url: mediaAsset.secureUrl,
          occurredAt: mediaAsset.createdAt,
        };
        this.eventEmitter.emit(MEDIA_UPLOADED_EVENT, eventPayload);
        importedAssets.push(mediaAsset);
      } catch (dbError: any) {
        this.logger.error(`Database transaction failed for URL import: ${dbError.message}`);
        try {
          if (result.publicId) await this.storageProvider.delete(result.publicId);
        } catch {
          // Ignore cleanup error
        }
        errors.push(`URL (${trimmedUrl.slice(0, 40)}...): Database error ${dbError.message}`);
      }
    }

    if (importedAssets.length === 0 && errors.length > 0) {
      throw new BadRequestException(`Failed to import media URLs: ${errors.join(', ')}`);
    }

    return importedAssets;
  }

  async updateAsset(
    id: string,
    dto: UpdateMediaDto,
    actor?: AuthenticatedUser,
  ): Promise<IMediaAsset> {
    const existing = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Media asset not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const newEntityType = dto.entityType ?? existing.entityType;
      let newEntityId = dto.entityId !== undefined ? dto.entityId : existing.entityId;

      if (dto.category !== undefined) {
        newEntityId = dto.category || null;
      }

      // If moving away from TOUR, clean up tour image link
      if (existing.entityType === MediaEntityType.TOUR && existing.entityId && newEntityType !== MediaEntityType.TOUR) {
        await tx.tourImage.deleteMany({
          where: { tourId: existing.entityId, imageUrl: existing.secureUrl },
        });
      }

      // If moving to TOUR, link to tour images
      if (newEntityType === MediaEntityType.TOUR && newEntityId && (existing.entityType !== MediaEntityType.TOUR || existing.entityId !== newEntityId)) {
        const existingTourImages = await tx.tourImage.findMany({
          where: { tourId: newEntityId },
          orderBy: { sortOrder: 'desc' },
          take: 1,
        });
        const nextOrder = existingTourImages.length > 0 ? existingTourImages[0].sortOrder + 1 : 0;
        await tx.tourImage.create({
          data: {
            tourId: newEntityId,
            imageUrl: existing.secureUrl,
            altText: dto.altText ?? existing.altText,
            sortOrder: nextOrder,
          },
        });
      }

      const asset = await tx.mediaAsset.update({
        where: { id },
        data: {
          altText: dto.altText !== undefined ? sanitizePlainText(dto.altText).slice(0, 255) || null : undefined,
          entityType: newEntityType,
          entityId: newEntityId,
        },
      });

      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'MEDIA_ASSET_UPDATED',
            entityType: 'MEDIA_ASSET',
            entityId: id,
            metadata: {
              previousEntityType: existing.entityType,
              previousEntityId: existing.entityId,
              newEntityType,
              newEntityId,
            },
          },
        });
      }

      return asset as IMediaAsset;
    });

    return updated;
  }

  async bulkMoveAssets(
    dto: BulkMoveMediaDto,
    actor?: AuthenticatedUser,
  ): Promise<{ success: boolean; updatedCount: number }> {
    const { assetIds, entityType, entityId, categorySlug } = dto;
    if (!assetIds.length) {
      throw new BadRequestException('No media asset IDs provided');
    }

    const targetEntityId = entityType === MediaEntityType.GENERAL ? (categorySlug || entityId || null) : (entityId || null);

    const result = await this.prisma.$transaction(async (tx) => {
      const assets = await tx.mediaAsset.findMany({
        where: { id: { in: assetIds }, deletedAt: null },
      });

      // Cleanup tour links for any assets leaving TOUR
      for (const a of assets) {
        if (a.entityType === MediaEntityType.TOUR && a.entityId && entityType !== MediaEntityType.TOUR) {
          await tx.tourImage.deleteMany({
            where: { tourId: a.entityId, imageUrl: a.secureUrl },
          });
        }
      }

      const updateRes = await tx.mediaAsset.updateMany({
        where: { id: { in: assetIds }, deletedAt: null },
        data: {
          entityType,
          entityId: targetEntityId,
        },
      });

      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'MEDIA_ASSETS_BULK_MOVED',
            entityType: 'MEDIA_ASSET',
            entityId: assetIds[0],
            metadata: {
              assetCount: updateRes.count,
              targetEntityType: entityType,
              targetEntityId,
            },
          },
        });
      }

      return updateRes.count;
    });

    return { success: true, updatedCount: result };
  }

  async getCategoriesWithCounts(): Promise<MediaCategoryItem[]> {
    let customCategories: MediaCategoryItem[] = [];
    try {
      const cmsBlock = await this.prisma.cmsBlock.findUnique({
        where: { key: CMS_MEDIA_CATEGORIES_KEY },
      });
      if (cmsBlock && Array.isArray(cmsBlock.content)) {
        customCategories = cmsBlock.content as unknown as MediaCategoryItem[];
      }
    } catch {
      // Fallback
    }

    const allCategoriesMap = new Map<string, MediaCategoryItem>();
    for (const cat of DEFAULT_CATEGORIES) {
      allCategoriesMap.set(cat.slug, { ...cat });
    }
    for (const cat of customCategories) {
      allCategoriesMap.set(cat.slug, { ...cat, isSystem: false });
    }

    // Count live assets for each category/entityType
    const [groupedByType, generalAssets] = await Promise.all([
      this.prisma.mediaAsset.groupBy({
        by: ['entityType'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { entityType: MediaEntityType.GENERAL, deletedAt: null },
        select: { entityId: true },
      }),
    ]);

    const typeCounts: Record<string, number> = {
      TOUR: 0,
      HOTEL: 0,
      GENERAL: 0,
    };
    for (const g of groupedByType) {
      typeCounts[g.entityType] = g._count.id;
    }

    const tourImagesTotal = await this.prisma.tourImage.count();

    if (allCategoriesMap.has('tours')) {
      allCategoriesMap.get('tours')!.count = typeCounts.TOUR;
    }
    if (allCategoriesMap.has('hotels')) {
      allCategoriesMap.get('hotels')!.count = typeCounts.HOTEL;
    }

    // Count general categories based on entityId (category slug)
    const slugCounts: Record<string, number> = { general: 0 };
    for (const a of generalAssets) {
      const slug = a.entityId || 'general';
      slugCounts[slug] = (slugCounts[slug] || 0) + 1;
    }

    // Merge transport & fleet synonym counts
    const transportTotal =
      (slugCounts['transport'] || 0) +
      (slugCounts['fleet'] || 0) +
      (slugCounts['transportation'] || 0);
    slugCounts['transport'] = transportTotal;
    slugCounts['fleet'] = transportTotal;

    for (const [slug, item] of allCategoriesMap.entries()) {
      if (slug !== 'tours' && slug !== 'hotels') {
        item.count = slugCounts[slug] || 0;
      }
    }

    return Array.from(allCategoriesMap.values());
  }

  async createCategory(
    dto: CreateMediaCategoryDto,
    actor?: AuthenticatedUser,
  ): Promise<MediaCategoryItem> {
    const rawSlug = typeof dto.slug === 'string' && dto.slug.trim()
      ? dto.slug.trim()
      : (typeof dto.nameEn === 'string' && dto.nameEn.trim() ? dto.nameEn.trim() : 'category');
    const slug = rawSlug.toLowerCase().replace(/\s+/g, '-');
    const existing = await this.getCategoriesWithCounts();
    if (existing.some((c) => c.slug === slug)) {
      throw new BadRequestException(`Category with slug '${slug}' already exists`);
    }

    const cleanNameEn = typeof dto.nameEn === 'string' && dto.nameEn.trim() ? dto.nameEn.trim() : slug;
    const cleanNameAr = typeof dto.nameAr === 'string' && dto.nameAr.trim() ? dto.nameAr.trim() : cleanNameEn;

    const newCategory: MediaCategoryItem = {
      id: slug,
      slug,
      nameEn: cleanNameEn,
      nameAr: cleanNameAr,
      color: dto.color || 'amber',
      icon: dto.icon || 'Folder',
      description: dto.description || '',
      isSystem: false,
      count: 0,
    };

    const currentBlock = await this.prisma.cmsBlock.findUnique({
      where: { key: CMS_MEDIA_CATEGORIES_KEY },
    });
    const currentList: MediaCategoryItem[] = currentBlock && Array.isArray(currentBlock.content)
      ? (currentBlock.content as unknown as MediaCategoryItem[])
      : [];

    currentList.push(newCategory);

    await this.prisma.cmsBlock.upsert({
      where: { key: CMS_MEDIA_CATEGORIES_KEY },
      create: {
        key: CMS_MEDIA_CATEGORIES_KEY,
        content: currentList as any,
        status: 'PUBLISHED',
        lastUpdatedBy: actor?.id,
      },
      update: {
        content: currentList as any,
        lastUpdatedBy: actor?.id,
        version: { increment: 1 },
      },
    });

    return newCategory;
  }

  async updateCategory(
    slug: string,
    dto: UpdateMediaCategoryDto,
    actor?: AuthenticatedUser,
  ): Promise<MediaCategoryItem> {
    const currentBlock = await this.prisma.cmsBlock.findUnique({
      where: { key: CMS_MEDIA_CATEGORIES_KEY },
    });
    const currentList: MediaCategoryItem[] = currentBlock && Array.isArray(currentBlock.content)
      ? (currentBlock.content as unknown as MediaCategoryItem[])
      : [];

    const index = currentList.findIndex((c) => c.slug === slug);
    if (index === -1) {
      // Check if it's default
      const def = DEFAULT_CATEGORIES.find((c) => c.slug === slug);
      if (def) {
        // Create an overridden version in custom list
        const updated = {
          ...def,
          nameEn: dto.nameEn || def.nameEn,
          nameAr: dto.nameAr || def.nameAr,
          color: dto.color || def.color,
          icon: dto.icon || def.icon,
          description: dto.description || def.description,
        };
        currentList.push(updated);
      } else {
        throw new NotFoundException(`Category '${slug}' not found`);
      }
    } else {
      currentList[index] = {
        ...currentList[index],
        nameEn: dto.nameEn || currentList[index].nameEn,
        nameAr: dto.nameAr || currentList[index].nameAr,
        color: dto.color || currentList[index].color,
        icon: dto.icon || currentList[index].icon,
        description: dto.description !== undefined ? dto.description : currentList[index].description,
      };
    }

    await this.prisma.cmsBlock.upsert({
      where: { key: CMS_MEDIA_CATEGORIES_KEY },
      create: {
        key: CMS_MEDIA_CATEGORIES_KEY,
        content: currentList as any,
        status: 'PUBLISHED',
        lastUpdatedBy: actor?.id,
      },
      update: {
        content: currentList as any,
        lastUpdatedBy: actor?.id,
        version: { increment: 1 },
      },
    });

    const all = await this.getCategoriesWithCounts();
    return all.find((c) => c.slug === slug)!;
  }

  async deleteCategory(
    slug: string,
    actor?: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const isSystem = DEFAULT_CATEGORIES.some((c) => c.slug === slug && c.isSystem);
    if (isSystem) {
      throw new BadRequestException('System categories cannot be deleted');
    }

    // Safely reassign any assets in this category to general
    await this.prisma.mediaAsset.updateMany({
      where: { entityId: slug, entityType: MediaEntityType.GENERAL },
      data: { entityId: null },
    });

    const currentBlock = await this.prisma.cmsBlock.findUnique({
      where: { key: CMS_MEDIA_CATEGORIES_KEY },
    });
    if (currentBlock && Array.isArray(currentBlock.content)) {
      const filtered = (currentBlock.content as unknown as MediaCategoryItem[]).filter(
        (c) => c.slug !== slug,
      );
      await this.prisma.cmsBlock.update({
        where: { key: CMS_MEDIA_CATEGORIES_KEY },
        data: { content: filtered as any, lastUpdatedBy: actor?.id },
      });
    }

    return { success: true, message: `Category '${slug}' deleted and assets moved to General.` };
  }

  async deleteAsset(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<DeleteMediaResponseDto> {
    this.logger.debug(`Delete initiated { id: ${id} }`);

    const deletedAt = new Date();
    const asset = await this.prisma.$transaction(
      async (tx) => {
        const record = await tx.mediaAsset.findFirst({
          where: { id, deletedAt: null },
        });
        if (!record) {
          throw new NotFoundException('Media asset not found');
        }
        const isAdmin = actor && (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN');
        if (
          actor &&
          !isAdmin &&
          record.uploadedBy !== actor.id
        ) {
          throw new ForbiddenException(
            'You can only delete media that you uploaded',
          );
        }

        const [docCount, attachCount] = await Promise.all([
          tx.customerDocument.count({ where: { mediaAssetId: id } }),
          tx.bookingAttachment.count({ where: { mediaAssetId: id } }),
        ]);
        if (docCount > 0 || attachCount > 0) {
          throw new BadRequestException(
            'Media asset is attached to customer documents or booking attachments and cannot be removed',
          );
        }

        // Clean up references in hotel hero media before soft deleting
        await tx.hotel.updateMany({
          where: { heroMediaId: id },
          data: { heroMediaId: null },
        });

        const claimed = await tx.mediaAsset.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt },
        });
        if (claimed.count !== 1) {
          throw new NotFoundException('Media asset not found');
        }

        if (record.entityType === MediaEntityType.TOUR && record.entityId) {
          await tx.tourImage.deleteMany({
            where: {
              tourId: record.entityId,
              imageUrl: record.secureUrl,
            },
          });
        }
        if (actor) {
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              actorRole: actor.role,
              action: 'MEDIA_ASSET_DELETED',
              entityType: 'MEDIA_ASSET',
              entityId: record.id,
              metadata: {
                mediaEntityType: record.entityType,
                mediaEntityId: record.entityId,
              },
            },
          });
        }
        return record;
      },
      { isolationLevel: 'Serializable' },
    );

    let providerDeleteFailed = false;
    try {
      if (asset.publicId) {
        await this.storageProvider.delete(asset.publicId);
      }
    } catch {
      this.logger.warn('Cloud provider delete failed for a soft-deleted asset');
      providerDeleteFailed = true;
    }

    return {
      id: asset.id,
      deletedAt,
      providerDeleteFailed,
    };
  }

  async listAssets(
    query: ListMediaDto,
  ): Promise<{
    data: IMediaAsset[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 20,
      entityType,
      entityId,
      category,
      format,
      includeDeleted = false,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const andConditions: Prisma.MediaAssetWhereInput[] = [];

    if (!includeDeleted) {
      andConditions.push({ deletedAt: null });
    }

    if (entityType) {
      andConditions.push({ entityType });
    }

    if (entityId) {
      andConditions.push({ entityId });
    }

    if (category && category !== 'all') {
      if (category === 'tours') {
        andConditions.push({ entityType: MediaEntityType.TOUR });
      } else if (category === 'hotels') {
        andConditions.push({ entityType: MediaEntityType.HOTEL });
      } else if (category === 'general') {
        andConditions.push({
          entityType: MediaEntityType.GENERAL,
          OR: [{ entityId: null }, { entityId: 'general' }],
        });
      } else if (
        category === 'transport' ||
        category === 'fleet' ||
        category === 'transportation'
      ) {
        andConditions.push({
          entityType: MediaEntityType.GENERAL,
          entityId: { in: ['transport', 'fleet', 'transportation'] },
        });
      } else {
        andConditions.push({
          entityType: MediaEntityType.GENERAL,
          entityId: category,
        });
      }
    }

    if (format && format !== 'all') {
      const cleanFormat = typeof format === 'string' ? format.toLowerCase().trim() : '';
      if (cleanFormat) {
        andConditions.push({ format: cleanFormat });
      }
    }

    if (typeof search === 'string' && search.trim()) {
      const needle = search.trim();
      andConditions.push({
        OR: [
          { altText: { contains: needle, mode: 'insensitive' } },
          { publicId: { contains: needle, mode: 'insensitive' } },
          { entityId: { contains: needle, mode: 'insensitive' } },
          { url: { contains: needle, mode: 'insensitive' } },
          { secureUrl: { contains: needle, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.MediaAssetWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const orderBy: Prisma.MediaAssetOrderByWithRelationInput =
      sortBy === 'bytes' ? { bytes: sortOrder } : { createdAt: sortOrder };

    const [assets, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    this.logger.debug(
      `List assets queried { filters: ${JSON.stringify(where)}, total: ${total} }`,
    );

    return {
      data: assets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAssetsByTourId(tourId: string): Promise<IMediaAsset[]> {
    const tour = await this.prisma.tour.findFirst({
      where: {
        id: tourId,
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        entityType: MediaEntityType.TOUR,
        entityId: tourId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return assets;
  }

  async getAssetsByHotelId(hotelId: string): Promise<IMediaAsset[]> {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return this.prisma.mediaAsset.findMany({
      where: {
        entityType: MediaEntityType.HOTEL,
        entityId: hotelId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSummary(): Promise<{
    total: number;
    bytes: number;
    byEntityType: Record<MediaEntityType, number>;
  }> {
    const where = { deletedAt: null };
    const [aggregate, grouped] = await Promise.all([
      this.prisma.mediaAsset.aggregate({ where, _count: { id: true }, _sum: { bytes: true } }),
      this.prisma.mediaAsset.groupBy({
        by: ['entityType'],
        where,
        _count: { id: true },
      }),
    ]);
    const byEntityType: Record<MediaEntityType, number> = {
      TOUR: 0,
      HOTEL: 0,
      GENERAL: 0,
    };
    for (const g of grouped) {
      if (g.entityType && byEntityType[g.entityType] !== undefined) {
        byEntityType[g.entityType] = g._count.id;
      }
    }

    return {
      total: aggregate._count.id,
      bytes: aggregate._sum.bytes ?? 0,
      byEntityType,
    };
  }

  async getPublicGallery(limit = 100, category?: string): Promise<IMediaAsset[]> {
    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: null,
    };

    if (category && category !== 'all') {
      if (category === 'tours') {
        where.entityType = MediaEntityType.TOUR;
      } else if (category === 'hotels') {
        where.entityType = MediaEntityType.HOTEL;
      } else if (category === 'general') {
        where.entityType = MediaEntityType.GENERAL;
        where.OR = [
          { entityId: null },
          { entityId: 'general' },
          { entityId: 'all' },
          { entityId: '' },
        ];
      } else if (
        category === 'transport' ||
        category === 'fleet' ||
        category === 'transportation'
      ) {
        where.entityType = MediaEntityType.GENERAL;
        where.entityId = { in: ['transport', 'fleet', 'transportation'] };
      } else {
        where.entityType = MediaEntityType.GENERAL;
        where.entityId = category;
      }
    } else {
      where.entityType = MediaEntityType.GENERAL;
    }

    return this.prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedAssets(): Promise<void> {
    this.logger.log(
      'Starting scheduled cleanup of orphaned MediaAsset records...',
    );
    try {
      const entityAssets = await this.prisma.mediaAsset.findMany({
        where: {
          entityType: { in: [MediaEntityType.TOUR, MediaEntityType.HOTEL] },
          deletedAt: null,
          entityId: { not: null },
        },
        select: { id: true, entityType: true, entityId: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      const tourIds = [
        ...new Set(
          entityAssets
            .filter((asset) => asset.entityType === MediaEntityType.TOUR)
            .map((asset) => asset.entityId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const hotelIds = [
        ...new Set(
          entityAssets
            .filter((asset) => asset.entityType === MediaEntityType.HOTEL)
            .map((asset) => asset.entityId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const [activeTours, activeHotels] = await Promise.all([
        this.prisma.tour.findMany({
          where: { id: { in: tourIds }, deletedAt: null },
          select: { id: true },
        }),
        this.prisma.hotel.findMany({
          where: { id: { in: hotelIds }, deletedAt: null },
          select: { id: true },
        }),
      ]);
      const activeTourIds = new Set(activeTours.map((tour) => tour.id));
      const activeHotelIds = new Set(activeHotels.map((hotel) => hotel.id));

      let count = 0;
      for (const asset of entityAssets) {
        const entityExists =
          asset.entityType === MediaEntityType.TOUR
            ? activeTourIds.has(asset.entityId ?? '')
            : activeHotelIds.has(asset.entityId ?? '');
        if (asset.entityId && !entityExists) {
          this.logger.warn(
            `Found orphaned MediaAsset { id: ${asset.id}, entityId: ${asset.entityId} }, soft-deleting...`,
          );
          try {
            await this.deleteAsset(asset.id);
            count++;
          } catch (error: unknown) {
            if (!(error instanceof NotFoundException)) throw error;
          }
        }
      }
      this.logger.log(
        `Completed scheduled cleanup. Orphaned assets removed: ${count}`,
      );
    } catch {
      this.logger.error('Scheduled orphaned media cleanup failed');
    }
  }

  async getPublicShowcase(): Promise<HomepageMediaShowcaseResponseDto> {
    const [photoAssets, videoAssets] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: {
          isShowcase: true,
          showcaseSection: 'PHOTO',
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
        orderBy: [{ showcasePosition: 'asc' }, { createdAt: 'asc' }],
        take: 50,
      }),
      this.prisma.mediaAsset.findMany({
        where: {
          isShowcase: true,
          showcaseSection: 'VIDEO',
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
        orderBy: [{ showcasePosition: 'asc' }, { createdAt: 'asc' }],
        take: 50,
      }),
    ]);

    // Graceful fallback for photos if no showcase items assigned yet
    let finalPhotos = photoAssets;
    if (finalPhotos.length === 0) {
      finalPhotos = await this.prisma.mediaAsset.findMany({
        where: {
          entityType: MediaEntityType.GENERAL,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
    }

    const cloudName = this.configService.get<string>('storage.cloudinaryCloudName') || 'u7xf91gp';

    const photos: ShowcasePhotoItemDto[] = finalPhotos.map((p, idx) => ({
      id: p.id,
      title: p.title || p.altText || 'Dunas Luxury Journey',
      alt: p.altText || p.title || 'Dunas Luxury Journey',
      url: p.secureUrl || p.url,
      optimizedUrl: p.optimizedUrl || p.secureUrl || p.url,
      thumbnailUrl: p.thumbnailUrl || p.secureUrl || p.url,
      position: p.showcasePosition ?? idx + 1,
      isActive: p.isActive,
      width: p.width,
      height: p.height,
      category: p.entityId || 'general',
    }));

    const videos: ShowcaseVideoItemDto[] = videoAssets.map((v, idx) => {
      const poster = v.thumbnailUrl || (v.providerName === 'cloudinary'
        ? `https://res.cloudinary.com/${cloudName}/video/upload/w_800,h_480,c_fill/${v.publicId}.jpg`
        : v.secureUrl);
      return {
        id: v.id,
        title: v.title || v.altText || 'Dunas Travel Story',
        alt: v.altText || v.title || 'Dunas Travel Story',
        url: v.secureUrl || v.url,
        videoUrl: v.secureUrl || v.url,
        thumbnailUrl: poster,
        posterUrl: poster,
        duration: v.duration ?? 45,
        position: v.showcasePosition ?? idx + 1,
        isActive: v.isActive,
        width: v.width,
        height: v.height,
      };
    });

    return { photos, videos };
  }

  async getAdminShowcase(): Promise<{ photos: IMediaAsset[]; videos: IMediaAsset[] }> {
    const [photos, videos] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: {
          isShowcase: true,
          showcaseSection: 'PHOTO',
          deletedAt: null,
        },
        orderBy: [{ showcasePosition: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.mediaAsset.findMany({
        where: {
          isShowcase: true,
          showcaseSection: 'VIDEO',
          deletedAt: null,
        },
        orderBy: [{ showcasePosition: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return { photos: photos as IMediaAsset[], videos: videos as IMediaAsset[] };
  }

  async addToShowcase(dto: AssignToShowcaseDto, actor?: AuthenticatedUser): Promise<IMediaAsset> {
    const targetId = dto.assetId || dto.mediaId;
    if (!targetId) {
      throw new BadRequestException('Either assetId or mediaId must be provided');
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: targetId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    let position = dto.position;
    if (typeof position !== 'number') {
      const maxPos = await this.prisma.mediaAsset.aggregate({
        where: { isShowcase: true, showcaseSection: dto.section, deletedAt: null },
        _max: { showcasePosition: true },
      });
      position = (maxPos._max.showcasePosition ?? 0) + 1;
    }

    const cleanTitle =
      dto.title !== undefined
        ? typeof dto.title === 'string' && dto.title.trim()
          ? dto.title.trim()
          : null
        : asset.title;
    const cleanAltText =
      dto.altText !== undefined
        ? typeof dto.altText === 'string' && dto.altText.trim()
          ? dto.altText.trim()
          : null
        : asset.altText;
    const cleanDescription =
      dto.description !== undefined
        ? typeof dto.description === 'string' && dto.description.trim()
          ? dto.description.trim()
          : null
        : asset.description;

    const updated = await this.prisma.mediaAsset.update({
      where: { id: targetId },
      data: {
        isShowcase: true,
        showcaseSection: dto.section,
        showcasePosition: position,
        title: cleanTitle,
        altText: cleanAltText,
        description: cleanDescription,
        isActive: true,
        isPublished: true,
      },
    });

    if (actor) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MEDIA_ADDED_TO_SHOWCASE',
          entityType: 'MEDIA_ASSET',
          entityId: asset.id,
          metadata: {
            section: dto.section,
            position,
          },
        },
      });
    }

    return updated as IMediaAsset;
  }

  async updateShowcaseItem(id: string, dto: UpdateShowcaseItemDto, actor?: AuthenticatedUser): Promise<IMediaAsset> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const cleanTitle =
      dto.title !== undefined
        ? typeof dto.title === 'string' && dto.title.trim()
          ? dto.title.trim()
          : null
        : asset.title;
    const cleanAltText =
      dto.altText !== undefined
        ? typeof dto.altText === 'string' && dto.altText.trim()
          ? dto.altText.trim()
          : null
        : asset.altText;
    const cleanDescription =
      dto.description !== undefined
        ? typeof dto.description === 'string' && dto.description.trim()
          ? dto.description.trim()
          : null
        : asset.description;

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        title: cleanTitle,
        altText: cleanAltText,
        description: cleanDescription,
        showcasePosition: dto.position !== undefined ? dto.position : asset.showcasePosition,
        isActive: dto.isActive !== undefined ? dto.isActive : asset.isActive,
        isPublished: dto.isPublished !== undefined ? dto.isPublished : asset.isPublished,
      },
    });

    if (actor) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MEDIA_SHOWCASE_UPDATED',
          entityType: 'MEDIA_ASSET',
          entityId: asset.id,
          metadata: { ...dto },
        },
      });
    }

    return updated as IMediaAsset;
  }

  async reorderShowcase(dto: ReorderShowcaseDto, actor?: AuthenticatedUser): Promise<{ success: boolean; count: number }> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Items array cannot be empty');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.mediaAsset.update({
          where: { id: item.id },
          data: { showcasePosition: item.position },
        });
      }

      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'MEDIA_SHOWCASE_REORDERED',
            entityType: 'MEDIA_ASSET',
            entityId: dto.items[0].id,
            metadata: {
              section: dto.section,
              itemCount: dto.items.length,
            },
          },
        });
      }
    });

    return { success: true, count: dto.items.length };
  }

  async removeFromShowcase(id: string, actor?: AuthenticatedUser): Promise<{ success: boolean; message: string }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        isShowcase: false,
        showcasePosition: null,
      },
    });

    if (actor) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'MEDIA_REMOVED_FROM_SHOWCASE',
          entityType: 'MEDIA_ASSET',
          entityId: asset.id,
          metadata: {
            previousSection: asset.showcaseSection,
          },
        },
      });
    }

    return { success: true, message: 'Asset removed from homepage showcase' };
  }

  async uploadVideoAsset(
    file: UploadableFile | undefined,
    dto: {
      title?: string;
      description?: string;
      altText?: string;
      categorySlug?: string;
      addToShowcase?: boolean;
      videoUrl?: string;
      posterUrl?: string;
    },
    userId: string,
    posterFile?: UploadableFile,
  ): Promise<IMediaAsset> {
    const rawVideoUrl = typeof dto.videoUrl === 'string' ? dto.videoUrl.trim() : '';
    if (!file && !rawVideoUrl) {
      throw new BadRequestException('Either a video file or a video URL must be provided');
    }

    let resolvedPosterUrl =
      typeof dto.posterUrl === 'string' && dto.posterUrl.trim()
        ? dto.posterUrl.trim()
        : null;

    // 1. Process custom poster image file if provided
    if (posterFile) {
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
      if (!allowedImageMimes.includes(posterFile.mimetype.toLowerCase())) {
        throw new BadRequestException('Invalid poster image format. Allowed: JPG, PNG, WebP, AVIF');
      }

      const posterFolder = `${this.configService.get<string>('storage.uploadFolder') || 'dunas-travel'}/videos/posters`;
      const posterOptions: UploadOptions = {
        folder: posterFolder,
        entityType: MediaEntityType.GENERAL,
        entityId: dto.categorySlug || 'posters',
        altText: dto.title ? `${dto.title} Poster` : 'Video Poster',
        eager: [],
        resourceType: 'image',
      };

      const posterResult = await this.storageProvider.upload(posterFile, posterOptions);
      if (posterResult.success && posterResult.secureUrl) {
        resolvedPosterUrl = posterResult.secureUrl;
      }
    }

    // 2. Determine showcase position if adding to showcase
    let showcasePosition: number | null = null;
    const shouldAddToShowcase = dto.addToShowcase ?? true;
    if (shouldAddToShowcase) {
      const maxItem = await this.prisma.mediaAsset.findFirst({
        where: { isShowcase: true, showcaseSection: 'VIDEO', deletedAt: null },
        orderBy: { showcasePosition: 'desc' },
        select: { showcasePosition: true },
      });
      showcasePosition = (maxItem?.showcasePosition ?? 0) + 1;
    }

    let asset;

    // 3A. File Upload Flow
    if (file) {
      const allowedVideoMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
      const maxSizeBytes = 100 * 1024 * 1024; // 100MB

      if (!file.mimetype || !allowedVideoMimes.includes(file.mimetype.toLowerCase())) {
        throw new BadRequestException('Invalid video format. Allowed: MP4, WebM, QuickTime, MKV');
      }

      if (file.size > maxSizeBytes) {
        throw new BadRequestException('Video exceeds maximum size of 100MB');
      }

      const folder = `${this.configService.get<string>('storage.uploadFolder') || 'dunas-travel'}/videos/${dto.categorySlug || 'showcase'}`;
      const options: UploadOptions = {
        folder,
        entityType: MediaEntityType.GENERAL,
        entityId: dto.categorySlug || 'videos',
        altText: dto.altText || dto.title || null,
        eager: [],
        resourceType: 'video',
      };

      const result = await this.storageProvider.upload(file, options);
      if (!result.success) {
        throw new HttpException(
          `Video upload failed: ${result.error || 'Provider error'}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const cloudName = this.configService.get<string>('storage.cloudinaryCloudName') || 'u7xf91gp';
      const autoPosterUrl = `https://res.cloudinary.com/${cloudName}/video/upload/w_800,h_480,c_fill/${result.publicId}.jpg`;
      const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/q_auto/${result.publicId}.mp4`;

      asset = await this.prisma.mediaAsset.create({
        data: {
          publicId: result.publicId,
          url: result.url,
          secureUrl: result.secureUrl,
          providerName: 'cloudinary',
          format: result.format || 'mp4',
          mimeType: file.mimetype,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          duration: result.duration,
          entityType: MediaEntityType.GENERAL,
          entityId: dto.categorySlug || 'videos',
          mediaType: 'VIDEO',
          cloudinaryResourceType: 'video',
          title:
            (typeof dto.title === 'string' && dto.title.trim()) ||
            (typeof dto.altText === 'string' && dto.altText.trim()) ||
            file.originalname,
          description:
            typeof dto.description === 'string' && dto.description.trim()
              ? dto.description.trim()
              : null,
          altText:
            (typeof dto.altText === 'string' && dto.altText.trim()) ||
            (typeof dto.title === 'string' && dto.title.trim()) ||
            null,
          thumbnailUrl: resolvedPosterUrl || autoPosterUrl,
          optimizedUrl,
          provenance: MediaProvenance.UPLOADED,
          uploadedBy: userId,
          isShowcase: shouldAddToShowcase,
          showcaseSection: 'VIDEO',
          showcasePosition,
        },
      });
    } else {
      // 3B. Video via URL / Link Flow
      const videoUrl = rawVideoUrl;
      if (!/^https?:\/\//i.test(videoUrl)) {
        throw new BadRequestException('Video URL must be a valid HTTP or HTTPS address');
      }

      let providerName = 'url';
      let ytId: string | null = null;
      const cleanVideoUrl = videoUrl.trim();
      try {
        if (cleanVideoUrl.includes('youtube.com') || cleanVideoUrl.includes('youtu.be')) {
          const parsed = new URL(cleanVideoUrl.startsWith('http') ? cleanVideoUrl : `https://${cleanVideoUrl}`);
          const v = parsed.searchParams.get('v');
          if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
            ytId = v;
          }
        }
      } catch {
        // Fall through
      }
      if (!ytId) {
        const ytMatch = cleanVideoUrl.match(
          /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=))([a-zA-Z0-9_-]{11})/i,
        );
        if (ytMatch) ytId = ytMatch[1];
      }
      const vimeoMatch = cleanVideoUrl.match(
        /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)/i,
      );

      if (ytId) {
        providerName = 'youtube';
        if (!resolvedPosterUrl) {
          resolvedPosterUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
      } else if (vimeoMatch) {
        providerName = 'vimeo';
      }

      const publicId = `video_url_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const cleanTitle =
        (typeof dto.title === 'string' && dto.title.trim()) ||
        (typeof dto.altText === 'string' && dto.altText.trim()) ||
        'Showcase Video';
      const cleanAltText =
        (typeof dto.altText === 'string' && dto.altText.trim()) ||
        (typeof dto.title === 'string' && dto.title.trim()) ||
        null;
      const cleanDescription =
        typeof dto.description === 'string' && dto.description.trim()
          ? dto.description.trim()
          : null;

      asset = await this.prisma.mediaAsset.create({
        data: {
          publicId,
          url: videoUrl,
          secureUrl: videoUrl,
          providerName,
          format: 'mp4',
          mimeType: 'video/mp4',
          bytes: 0,
          width: 1920,
          height: 1080,
          duration: null,
          entityType: MediaEntityType.GENERAL,
          entityId: dto.categorySlug || 'videos',
          mediaType: 'VIDEO',
          cloudinaryResourceType: 'video',
          title: cleanTitle,
          description: cleanDescription,
          altText: cleanAltText,
          thumbnailUrl: resolvedPosterUrl || null,
          optimizedUrl: videoUrl,
          provenance: MediaProvenance.UPLOADED,
          uploadedBy: userId,
          isShowcase: shouldAddToShowcase,
          showcaseSection: 'VIDEO',
          showcasePosition,
        },
      });
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'VIDEO_ASSET_CREATED',
          entityType: 'MEDIA_ASSET',
          entityId: asset.id,
          metadata: {
            source: file ? 'file' : 'url',
            hasCustomPoster: !!resolvedPosterUrl,
            addToShowcase: shouldAddToShowcase,
            position: showcasePosition,
          },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return asset as IMediaAsset;
  }

  async optimizeAsset(id: string, dto: OptimizeAssetDto, actor?: AuthenticatedUser): Promise<IMediaAsset> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    let optimizedUrl = asset.secureUrl || asset.url;
    const isCloudinary = (asset.providerName?.toLowerCase() === 'cloudinary') ||
      asset.secureUrl.includes('cloudinary.com') ||
      asset.url.includes('cloudinary.com');

    const targetFormat = dto.format || 'webp';
    const quality = dto.quality || 'auto:good';
    const maxWidth = dto.maxWidth || dto.width || 1920;

    if (isCloudinary) {
      const sourceUrl = asset.secureUrl || asset.url;

      if (sourceUrl.includes('/image/upload/')) {
        if (/\/image\/upload\/(?:[^\/]+\/)?(v\d+\/.+)/.test(sourceUrl)) {
          optimizedUrl = sourceUrl.replace(
            /\/image\/upload\/(?:[^\/]+\/)?(v\d+\/.+)/,
            (_match, rest) => {
              const cleanRest = targetFormat === 'auto'
                ? rest
                : `${rest.replace(/\.[a-zA-Z0-9]+$/, '')}.${targetFormat}`;
              return `/image/upload/w_${maxWidth},c_limit,q_${quality},f_${targetFormat}/${cleanRest}`;
            },
          );
        } else {
          optimizedUrl = sourceUrl.replace(
            /\/image\/upload\//,
            `/image/upload/w_${maxWidth},c_limit,q_${quality},f_${targetFormat}/`,
          );
        }
      } else {
        const cloudName = this.configService.get<string>('storage.cloudinaryCloudName') || 'u7xf91gp';
        const cleanPublicId = targetFormat === 'auto'
          ? asset.publicId
          : `${asset.publicId?.replace(/\.[a-zA-Z0-9]+$/, '')}.${targetFormat}`;
        optimizedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_${maxWidth},c_limit,q_${quality},f_${targetFormat}/${cleanPublicId}`;
      }
    } else if (optimizedUrl && optimizedUrl.includes('images.unsplash.com')) {
      optimizedUrl = optimizedUrl.replace(/&fm=[^&]+/, '') + `&fm=${targetFormat === 'auto' ? 'webp' : targetFormat}`;
    }

    let verified = false;
    if (/^https?:\/\//i.test(optimizedUrl)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const checkRes = await fetch(optimizedUrl, {
          method: 'GET',
          headers: { Accept: 'image/webp,image/avif,*/*' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const contentType = checkRes.headers.get('content-type') || '';
        verified = checkRes.status === 200 && (contentType.includes('image') || contentType.includes('webp'));
      } catch {
        verified = isCloudinary;
      }
    } else {
      verified = true;
    }

    const finalFormat = targetFormat === 'auto' ? 'webp' : targetFormat;
    const updatedAsset = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        optimizedUrl,
        secureUrl: optimizedUrl,
        url: optimizedUrl,
        format: finalFormat,
        mimeType: `image/${finalFormat}`,
      },
    });

    // Propagate optimized WebP URL to any tour images referencing this asset
    try {
      await this.prisma.tourImage.updateMany({
        where: {
          imageUrl: { in: [asset.secureUrl, asset.url] },
        },
        data: {
          imageUrl: optimizedUrl,
        },
      });
    } catch (tourImgErr) {
      this.logger.warn(`Failed to propagate optimized WebP to tourImage: ${tourImgErr}`);
    }

    if (actor) {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'MEDIA_OPTIMIZED',
            entityType: 'MEDIA_ASSET',
            entityId: asset.id,
            metadata: {
              optimizedUrl,
              verified,
              format: targetFormat,
            },
          },
        });
      } catch (logErr) {
        this.logger.warn(`Failed to write audit log for optimizeAsset: ${logErr}`);
      }
    }

    return updatedAsset as IMediaAsset;
  }

  async checkMediaUsage(id: string): Promise<{
    isInUse: boolean;
    locations: string[];
    details: {
      tours: number;
      hotels: number;
      showcase: boolean;
      documents: number;
      attachments: number;
    };
  }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const [tourImagesCount, hotelHeroCount, docCount, attachCount] = await Promise.all([
      this.prisma.tourImage.count({
        where: {
          OR: [
            { imageUrl: asset.secureUrl },
            { imageUrl: asset.url },
            ...(asset.entityType === MediaEntityType.TOUR && asset.entityId ? [{ tourId: asset.entityId }] : []),
          ],
        },
      }),
      this.prisma.hotel.count({ where: { heroMediaId: id } }),
      this.prisma.customerDocument.count({ where: { mediaAssetId: id } }),
      this.prisma.bookingAttachment.count({ where: { mediaAssetId: id } }),
    ]);

    const locations: string[] = [];
    if (asset.isShowcase) locations.push(`Homepage Showcase (${asset.showcaseSection})`);
    if (tourImagesCount > 0) locations.push(`Tours (${tourImagesCount} references)`);
    if (hotelHeroCount > 0) locations.push(`Hotels (${hotelHeroCount} references)`);
    if (docCount > 0) locations.push(`Customer Documents (${docCount} references)`);
    if (attachCount > 0) locations.push(`Booking Attachments (${attachCount} references)`);

    return {
      isInUse: locations.length > 0,
      locations,
      details: {
        tours: tourImagesCount,
        hotels: hotelHeroCount,
        showcase: asset.isShowcase,
        documents: docCount,
        attachments: attachCount,
      },
    };
  }

  async syncEntityMedia(actor?: AuthenticatedUser): Promise<{ syncedTours: number; syncedHotels: number }> {
    const tourImages = await this.prisma.tourImage.findMany({
      select: { id: true, tourId: true, imageUrl: true, altText: true, isHero: true, isVideo: true },
    });

    let syncedTours = 0;
    for (const ti of tourImages) {
      const existing = await this.prisma.mediaAsset.findFirst({
        where: {
          OR: [
            { url: ti.imageUrl },
            { secureUrl: ti.imageUrl },
            { publicId: `tour-img-${ti.id}` },
          ],
          deletedAt: null,
        },
      });

      if (!existing) {
        const isCloudinary = ti.imageUrl.includes('cloudinary.com');
        const isWebp = ti.imageUrl.endsWith('.webp');
        await this.prisma.mediaAsset.create({
          data: {
            publicId: `tour-img-${ti.id}`,
            url: ti.imageUrl,
            secureUrl: ti.imageUrl,
            providerName: isCloudinary ? 'cloudinary' : 'external',
            format: isWebp ? 'webp' : 'jpg',
            mimeType: ti.isVideo ? 'video/mp4' : 'image/jpeg',
            bytes: 65000,
            entityType: MediaEntityType.TOUR,
            entityId: ti.tourId,
            mediaType: ti.isVideo ? 'VIDEO' : 'IMAGE',
            altText: ti.altText || 'Tour Image',
            provenance: MediaProvenance.SEEDED,
            isActive: true,
            isPublished: true,
          },
        });
        syncedTours++;
      }
    }

    // Sync hotel hero media
    const hotels = await this.prisma.hotel.findMany({
      select: { id: true, slug: true, heroMediaId: true },
    });
    let syncedHotels = 0;
    for (const h of hotels) {
      if (h.heroMediaId) {
        const existingHero = await this.prisma.mediaAsset.findFirst({
          where: { id: h.heroMediaId, deletedAt: null },
        });
        if (existingHero && existingHero.entityType !== MediaEntityType.HOTEL) {
          await this.prisma.mediaAsset.update({
            where: { id: existingHero.id },
            data: { entityType: MediaEntityType.HOTEL, entityId: h.slug },
          });
          syncedHotels++;
        }
      }
    }

    if (actor) {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'ENTITY_MEDIA_SYNCED',
          entityType: 'MEDIA_ASSET',
          entityId: 'sync-all',
          metadata: { syncedTours, syncedHotels },
        },
      });
    }

    return { syncedTours, syncedHotels };
  }
}
