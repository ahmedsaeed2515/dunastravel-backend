import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  StorageProvider,
  UploadableFile,
  UploadOptions,
  UploadResult,
  TransformOptions,
} from '../../../common/storage/storage-provider.interface';

@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>(
      'storage.cloudinaryCloudName',
    );
    const apiKey = this.configService.get<string>('storage.cloudinaryApiKey');
    const apiSecret = this.configService.get<string>(
      'storage.cloudinaryApiSecret',
    );

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async upload(
    file: UploadableFile,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const start = Date.now();
    const folderPath = `${options.folder}/${options.entityType.toLowerCase()}/${options.entityId ?? 'general'}`;
    const tags = [
      'dunas-travel',
      options.entityType,
      options.entityId ?? 'general',
    ];

    this.logger.debug(
      `Upload SDK call started { folder: ${folderPath}, eager count: ${options.eager.length} }`,
    );

    const isVideo = options.resourceType === 'video';
    const resourceType = isVideo ? ('video' as const) : ('image' as const);

    return new Promise((resolve) => {
      const uploadOptions: Record<string, any> = {
        resource_type: resourceType,
        folder: folderPath,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        tags: tags,
      };

      if (!isVideo) {
        uploadOptions.format = 'webp';
        uploadOptions.transformation = [
          { quality: 'auto:good' },
          { fetch_format: 'webp' },
        ];
        uploadOptions.eager = options.eager;
        uploadOptions.eager_async = false;
      } else {
        uploadOptions.eager = [
          {
            format: 'jpg',
            transformation: [{ width: 800, height: 480, crop: 'fill' }],
          },
          { format: 'mp4', quality: 'auto' },
        ];
        uploadOptions.eager_async = true;
      }

      const callback = (error: any, result: any) => {
        const duration_ms = Date.now() - start;
        if (error) {
          this.logger.error(
            `SDK error { operation: 'upload', errorCode: ${error.http_code || 'UNKNOWN'}, message: '${error.message}' }`,
          );
          return resolve({
            success: false,
            publicId: '',
            url: '',
            secureUrl: '',
            format: '',
            bytes: 0,
            width: null,
            height: null,
            duration: null,
            error: error.message,
          });
        }

        if (!result) {
          this.logger.error(
            `SDK error { operation: 'upload', errorCode: 'UNKNOWN', message: 'No result returned from Cloudinary' }`,
          );
          return resolve({
            success: false,
            publicId: '',
            url: '',
            secureUrl: '',
            format: '',
            bytes: 0,
            width: null,
            height: null,
            duration: null,
            error: 'Unknown error occurred during upload',
          });
        }

        this.logger.debug(
          `Upload SDK call completed { publicId: ${result.public_id}, duration_ms: ${duration_ms} }`,
        );

        let finalUrl = result.url;
        let finalSecureUrl = result.secure_url;
        if (result.eager && result.eager.length > 0) {
          // If video, finalSecureUrl remains the video secure_url
          if (!isVideo) {
            finalUrl = result.eager[0].url;
            finalSecureUrl = result.eager[0].secure_url;
          }
        }

        resolve({
          success: true,
          publicId: result.public_id,
          url: finalUrl,
          secureUrl: finalSecureUrl,
          format: result.format,
          bytes: result.bytes,
          width: result.width || null,
          height: result.height || null,
          duration:
            typeof result.duration === 'number' ? result.duration : null,
          error: null,
        });
      };

      if (file.path) {
        cloudinary.uploader.upload(file.path, uploadOptions, callback);
      } else if (file.buffer) {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          callback,
        );
        uploadStream.end(file.buffer);
      } else {
        resolve({
          success: false,
          publicId: '',
          url: '',
          secureUrl: '',
          format: '',
          bytes: 0,
          width: null,
          height: null,
          error: 'No buffer or path provided',
        });
      }
    });
  }

  async uploadUrl(url: string, options: UploadOptions): Promise<UploadResult> {
    const start = Date.now();
    const folderPath = `${options.folder}/${options.entityType.toLowerCase()}/${options.entityId ?? 'general'}`;
    const tags = [
      'dunas-travel',
      options.entityType,
      options.entityId ?? 'general',
      'url-import',
    ];

    this.logger.debug(
      `Upload URL SDK call started { url: ${url.slice(0, 100)}, folder: ${folderPath} }`,
    );

    return new Promise((resolve) => {
      const uploadOptions: Record<string, any> = {
        resource_type: 'image' as const,
        folder: folderPath,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        format: 'webp',
        transformation: [{ quality: 'auto:good' }, { fetch_format: 'webp' }],
        eager: options.eager,
        eager_async: false,
        tags: tags,
      };

      const callback = (error: any, result: any) => {
        const duration_ms = Date.now() - start;
        if (error) {
          this.logger.error(
            `SDK error { operation: 'uploadUrl', errorCode: ${error.http_code || 'UNKNOWN'}, message: '${error.message}' }`,
          );
          return resolve({
            success: false,
            publicId: '',
            url: '',
            secureUrl: '',
            format: '',
            bytes: 0,
            width: null,
            height: null,
            error: error.message || 'Failed to upload image from URL',
          });
        }

        if (!result) {
          this.logger.error(
            `SDK error { operation: 'uploadUrl', errorCode: 'UNKNOWN', message: 'No result returned from Cloudinary for URL' }`,
          );
          return resolve({
            success: false,
            publicId: '',
            url: '',
            secureUrl: '',
            format: '',
            bytes: 0,
            width: null,
            height: null,
            error: 'Unknown error occurred during URL upload',
          });
        }

        this.logger.debug(
          `Upload URL completed { publicId: ${result.public_id}, duration_ms: ${duration_ms} }`,
        );

        let finalUrl = result.url;
        let finalSecureUrl = result.secure_url;
        if (result.eager && result.eager.length > 0) {
          finalUrl = result.eager[0].url;
          finalSecureUrl = result.eager[0].secure_url;
        }

        resolve({
          success: true,
          publicId: result.public_id,
          url: finalUrl,
          secureUrl: finalSecureUrl,
          format: result.format,
          bytes: result.bytes,
          width: result.width || null,
          height: result.height || null,
          error: null,
        });
      };

      cloudinary.uploader.upload(url, uploadOptions, callback);
    });
  }

  async delete(
    publicId: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<void> {
    const start = Date.now();
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      const duration_ms = Date.now() - start;

      if (result.result !== 'ok' && result.result !== 'not found') {
        this.logger.error(
          `SDK error { operation: 'delete', errorCode: 'UNKNOWN', message: '${result.result}' }`,
        );
        throw new Error(
          `Failed to delete asset from Cloudinary: ${result.result}`,
        );
      }

      this.logger.debug(
        `Delete SDK call completed { publicId: ${publicId}, duration_ms: ${duration_ms} }`,
      );
    } catch (error: any) {
      const duration_ms = Date.now() - start;
      this.logger.error(
        `SDK error { operation: 'delete', errorCode: ${error.http_code || 'UNKNOWN'}, message: '${error.message}' }`,
      );
      throw error;
    }
  }

  async getDeliveryUrl(
    publicId: string,
    transformOptions?: TransformOptions,
  ): Promise<string> {
    return cloudinary.url(publicId, {
      format: 'webp',
      quality: 'auto:good',
      fetch_format: 'webp',
      ...transformOptions,
    });
  }

  getVideoPosterUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 800, height: 480, crop: 'fill', quality: 'auto' },
      ],
    });
  }
}
