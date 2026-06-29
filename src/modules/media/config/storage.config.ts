import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  uploadFolder: string;
}

export default registerAs('storage', (): StorageConfig => {
  const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error(
      'StorageConfig error: Cloudinary credentials are not properly configured.',
    );
  }

  const maxFileSizeBytes = process.env.STORAGE_MAX_FILE_SIZE_BYTES
    ? parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES, 10)
    : 10485760;

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  const uploadFolder = process.env.STORAGE_UPLOAD_FOLDER || 'dunas-travel';

  return {
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    maxFileSizeBytes,
    allowedMimeTypes,
    uploadFolder,
  };
});
