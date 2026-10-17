import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesValidationPipe implements PipeTransform<
  Express.Multer.File[]
> {
  private allowedMimeTypes: string[];

  constructor(private configService: ConfigService) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'storage.allowedMimeTypes',
    ) || ['image/jpeg', 'image/png', 'image/webp'];
  }

  transform(files: Express.Multer.File[]): Express.Multer.File[] {
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('No files were provided for upload.');
    }

    if (files.length > 25) {
      throw new BadRequestException(
        'Maximum 25 files can be uploaded in a single batch.',
      );
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || !file.buffer || file.buffer.length === 0) {
        throw new BadRequestException(
          `File #${i + 1} (${file?.originalname || 'unknown'}) is empty or corrupted.`,
        );
      }

      if (!this.allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        throw new BadRequestException(
          `File #${i + 1} (${file.originalname}) has invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP.`,
        );
      }

      if (!this.matchesDeclaredExtension(file.originalname, file.mimetype)) {
        throw new BadRequestException(
          `File #${i + 1} (${file.originalname}) extension does not match the declared MIME type.`,
        );
      }

      if (!this.verifyMagicNumber(file.buffer, file.mimetype)) {
        throw new BadRequestException(
          `File #${i + 1} (${file.originalname}) content does not match declared MIME type.`,
        );
      }
    }

    return files;
  }

  private verifyMagicNumber(buffer: Buffer, mimetype: string): boolean {
    if (mimetype === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    if (mimetype === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    if (mimetype === 'image/webp') {
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      );
    }

    return false;
  }

  private matchesDeclaredExtension(
    originalname: string,
    mimetype: string,
  ): boolean {
    if (typeof originalname !== 'string' || !originalname.includes('.')) {
      return false;
    }
    const extension = originalname.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
    };
    return Boolean(
      extension && expectedExtensions[mimetype]?.includes(extension),
    );
  }
}
