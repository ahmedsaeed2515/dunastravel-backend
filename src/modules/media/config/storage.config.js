"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('storage', function () {
    var cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    var cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    var cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
        throw new Error('StorageConfig error: Cloudinary credentials are not properly configured.');
    }
    var maxFileSizeBytes = process.env.STORAGE_MAX_FILE_SIZE_BYTES
        ? parseInt(process.env.STORAGE_MAX_FILE_SIZE_BYTES, 10)
        : 10485760;
    var allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    var uploadFolder = process.env.STORAGE_UPLOAD_FOLDER || 'dunas-travel';
    return {
        cloudinaryCloudName: cloudinaryCloudName,
        cloudinaryApiKey: cloudinaryApiKey,
        cloudinaryApiSecret: cloudinaryApiSecret,
        maxFileSizeBytes: maxFileSizeBytes,
        allowedMimeTypes: allowedMimeTypes,
        uploadFolder: uploadFolder,
    };
});
