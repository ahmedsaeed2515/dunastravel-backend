import { MediaEntityType } from '@prisma/client';

export interface EagerTransform {
  width?: number;
  height?: number;
  crop?: string;
  format?: string;
  quality?: string;
  [key: string]: any;
}

export interface TransformOptions {
  width?: number;
  height?: number;
  crop?: string;
  format?: string;
  quality?: string;
  [key: string]: any;
}

export interface UploadableFile {
  buffer?: Buffer;
  path?: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UploadOptions {
  folder: string;
  entityType: MediaEntityType;
  entityId: string | null;
  altText: string | null;
  eager: EagerTransform[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

export interface UploadResult {
  success: boolean;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration?: number | null;
  error: string | null;
}

export interface StorageProvider {
  upload(file: UploadableFile, options: UploadOptions): Promise<UploadResult>;
  uploadUrl(url: string, options: UploadOptions): Promise<UploadResult>;
  delete(publicId: string, resourceType?: 'image' | 'video'): Promise<void>;
  getDeliveryUrl(
    publicId: string,
    transformOptions?: TransformOptions,
  ): Promise<string>;
}
