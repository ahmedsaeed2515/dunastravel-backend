import * as fs from 'fs';
import {
  Injectable,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

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
    uploadedByUserId: string | null,
  ): Promise<IMediaAsset> {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
      'video/mp4',
      'application/pdf',
    ];
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB

    if (
      !file ||
      !file.mimetype ||
      !allowedMimeTypes.includes(file.mimetype.toLowerCase())
    ) {
      throw new BadRequestException(
        `Unsupported file MIME type '${file?.mimetype}'. Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size ${file.size} bytes exceeds maximum allowed limit of ${maxSizeBytes} bytes (20MB)`,
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
      entityId: dto.entityId,
      altText: dto.altText,
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
        `Failed to upload media: ${result?.error}`,
        HttpStatus.BAD_GATEWAY,
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
              entityId: dto.entityId,
              provenance: MediaProvenance.UPLOADED,
              altText: dto.altText,
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

  async deleteAsset(id: string): Promise<DeleteMediaResponseDto> {
    this.logger.debug(`Delete initiated { id: ${id} }`);

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });

    if (!asset) {
      throw new NotFoundException(
        `Media asset with ID ${id} not found or already deleted`,
      );
    }

    const [docCount, attachCount] = await Promise.all([
      this.prisma.customerDocument.count({ where: { mediaAssetId: id } }),
      this.prisma.bookingAttachment.count({ where: { mediaAssetId: id } }),
    ]);

    if (docCount > 0 || attachCount > 0) {
      throw new BadRequestException(
        `Media asset '${id}' is currently referenced by customer documents or booking attachments and cannot be removed without unlinking.`,
      );
    }

    const deletedAt = new Date();
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt },
    });

    // Also delete associated TourImage if it exists
    if (asset.entityType === MediaEntityType.TOUR && asset.entityId) {
      await this.prisma.tourImage.deleteMany({
        where: {
          tourId: asset.entityId,
          imageUrl: asset.secureUrl, // match by URL since there's no FK on MediaAsset id
        },
      });
    }

    let providerDeleteFailed = false;
    try {
      await this.storageProvider.delete(asset.publicId);
    } catch (error: any) {
      this.logger.warn(
        `Cloud provider delete failed, record soft-deleted { id: ${id}, error: ${error.message} }`,
      );
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
      });

      let count = 0;
      for (const asset of tourAssets) {
        if (asset.entityId) {
          const tour = await this.prisma.tour.findUnique({
            where: { id: asset.entityId },
          });
          if (!tour) {
            this.logger.warn(
              `Found orphaned MediaAsset { id: ${asset.id}, entityId: ${asset.entityId} }, soft-deleting...`,
            );
            await this.deleteAsset(asset.id);
            count++;
          }
        }
      }
      this.logger.log(
        `Completed scheduled cleanup. Orphaned assets removed: ${count}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error during scheduled cleanup of orphaned assets: ${error.message}`,
        error.stack,
      );
    }
  }
}
