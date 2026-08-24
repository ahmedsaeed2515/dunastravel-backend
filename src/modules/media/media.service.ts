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
import { ListMediaDto } from './dto/list-media.dto';
import { DeleteMediaResponseDto } from './dto/delete-media-response.dto';
import { IMediaAsset } from './interfaces/media-asset.interface';
import {
  MEDIA_UPLOADED_EVENT,
  MediaUploadedEvent,
} from './interfaces/media-events.interface';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

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
    } else if (dto.entityId) {
      throw new BadRequestException(
        'entityId is not allowed for general media',
      );
    }

    this.logger.debug(
      `Upload initiated { entityType: ${dto.entityType}, entityId: ${dto.entityId}, mimeType: ${file.mimetype}, bytes: ${file.size} }`,
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
      entityId: isEntityMedia ? (dto.entityId ?? null) : null,
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
              providerName: 'cloudinary', // Cloudinary is the sole provider for now
              format: result.format,
              mimeType: file.mimetype,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
              entityType: dto.entityType,
              entityId: isEntityMedia ? dto.entityId : null,
              provenance: MediaProvenance.UPLOADED,
              altText: sanitizePlainText(dto.altText).slice(0, 255) || null,
              uploadedBy: uploadedByUserId,
            },
          });

          this.logger.debug(
            `MediaAsset created { id: ${asset.id}, publicId: ${asset.publicId} }`,
          );

          if (dto.entityType === MediaEntityType.TOUR && dto.entityId) {
            // Sync with TourImage
            // We will find the current highest sortOrder and append
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
                mediaEntityId:
                  isEntityMedia ? dto.entityId : null,
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
        if (
          actor &&
          actor.role !== 'SUPER_ADMIN' &&
          record.uploadedBy !== actor.id
        ) {
          throw new ForbiddenException(
            'You can only delete media that you uploaded',
          );
        }

        const [docCount, attachCount, hotelHeroCount] = await Promise.all([
          tx.customerDocument.count({ where: { mediaAssetId: id } }),
          tx.bookingAttachment.count({ where: { mediaAssetId: id } }),
          tx.hotel.count({ where: { heroMediaId: id, deletedAt: null } }),
        ]);
        if (docCount > 0 || attachCount > 0 || hotelHeroCount > 0) {
          throw new BadRequestException(
            'Media asset is referenced and cannot be removed',
          );
        }

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
      await this.storageProvider.delete(asset.publicId);
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
      includeDeleted = false,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.MediaAssetWhereInput = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (search?.trim()) {
      const needle = search.trim();
      where.OR = [
        { altText: { contains: needle, mode: 'insensitive' } },
        { publicId: { contains: needle, mode: 'insensitive' } },
      ];
    }
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

    this.logger.debug(
      `Tour assets queried { tourId: ${tourId}, count: ${assets.length} }`,
    );
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
    for (const item of grouped) {
      byEntityType[item.entityType] = item._count.id;
    }
    return {
      total: aggregate._count.id,
      bytes: aggregate._sum.bytes ?? 0,
      byEntityType,
    };
  }

  async getPublicGallery(limit = 100): Promise<IMediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: {
        entityType: MediaEntityType.GENERAL,
        deletedAt: null,
      },
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
      // Entity-owned assets must not outlive a soft-deleted tour or hotel.
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
}
