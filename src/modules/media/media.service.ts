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
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    const maxSizeBytes =
      this.configService.get<number>('storage.maxFileSizeBytes') ||
      10 * 1024 * 1024;

    if (
      !file ||
      !file.mimetype ||
      !allowedMimeTypes.includes(file.mimetype.toLowerCase())
    ) {
      throw new BadRequestException(
        'Unsupported file type',
      );
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        'File exceeds the maximum allowed size',
      );
    }

    if (dto.entityType === MediaEntityType.TOUR) {
      if (!dto.entityId) {
        throw new BadRequestException(
          'entityId is required for tour media',
        );
      }
      const tour = await this.prisma.tour.findFirst({
        where: { id: dto.entityId, deletedAt: null },
        select: { id: true },
      });
      if (!tour) {
        throw new BadRequestException('Target tour does not exist');
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
      entityId:
        dto.entityType === MediaEntityType.TOUR
          ? (dto.entityId ?? null)
          : null,
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
    let outputIsSafe = false;
    try {
      const outputUrl = new URL(result.secureUrl);
      outputIsSafe =
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
        await this.storageProvider.delete(result.publicId);
      } catch {
        this.logger.error(
          'Invalid uploaded media also failed provider cleanup',
        );
      }
      throw new BadRequestException(
        'Uploaded media failed content validation',
      );
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
              entityId:
                dto.entityType === MediaEntityType.TOUR
                  ? dto.entityId
                  : null,
              provenance: MediaProvenance.UPLOADED,
              altText:
                sanitizePlainText(dto.altText).slice(0, 255) || null,
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
                  dto.entityType === MediaEntityType.TOUR
                    ? dto.entityId
                    : null,
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

        const [docCount, attachCount] = await Promise.all([
          tx.customerDocument.count({ where: { mediaAssetId: id } }),
          tx.bookingAttachment.count({ where: { mediaAssetId: id } }),
        ]);
        if (docCount > 0 || attachCount > 0) {
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
  ): Promise<{ data: IMediaAsset[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const {
      page = 1,
      limit = 20,
      entityType,
      entityId,
      includeDeleted = false,
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

    const [assets, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedAssets(): Promise<void> {
    this.logger.log(
      'Starting scheduled cleanup of orphaned MediaAsset records...',
    );
    try {
      // Find all MediaAssets associated with TOUR that are not deleted
      const tourAssets = await this.prisma.mediaAsset.findMany({
        where: {
          entityType: MediaEntityType.TOUR,
          deletedAt: null,
          entityId: { not: null },
        },
        select: { id: true, entityId: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      const tourIds = [
        ...new Set(
          tourAssets
            .map((asset) => asset.entityId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const activeTours = await this.prisma.tour.findMany({
        where: { id: { in: tourIds }, deletedAt: null },
        select: { id: true },
      });
      const activeTourIds = new Set(activeTours.map((tour) => tour.id));

      let count = 0;
      for (const asset of tourAssets) {
        if (asset.entityId && !activeTourIds.has(asset.entityId)) {
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
