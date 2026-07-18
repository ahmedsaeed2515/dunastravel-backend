import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileValidationPipe implements PipeTransform<Express.Multer.File> {
  private allowedMimeTypes: string[];

  constructor(private configService: ConfigService) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'storage.allowedMimeTypes',
    ) || ['image/jpeg', 'image/png', 'image/webp'];
  }

  async transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is missing.');
    }

    if (!file.buffer && file.path) {
      const fs = require('fs');
      file.buffer = fs.readFileSync(file.path);
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is missing or empty.');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    if (!this.verifyMagicNumber(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File content does not match declared MIME type.',
      );
    }

    return file;
  }

  private verifyMagicNumber(buffer: Buffer, mimetype: string): boolean {
    // Magic numbers
    // JPEG: FF D8 FF
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    // WebP: RIFF .... WEBP (bytes 0-3 and 8-11)

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
}
