import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(['image/jpeg', 'image/png', 'image/webp']),
    } as unknown as ConfigService;
    pipe = new FileValidationPipe(configService);
  });

  describe('transform', () => {
    it('should pass for valid JPEG magic numbers', () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
      const file = { buffer: validJpeg, mimetype: 'image/jpeg' } as any;
      expect(pipe.transform(file)).toBe(file);
    });

    it('should pass for valid PNG magic numbers', () => {
      const validPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const file = { buffer: validPng, mimetype: 'image/png' } as any;
      expect(pipe.transform(file)).toBe(file);
    });

    it('should pass for valid WebP magic numbers', () => {
      const validWebP = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // length
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      const file = { buffer: validWebP, mimetype: 'image/webp' } as any;
      expect(pipe.transform(file)).toBe(file);
    });

    it('should throw BadRequestException for PHP disguised as JPG', () => {
      const maliciousPhp = Buffer.from('<?php echo "hello"; ?>');
      const file = { buffer: maliciousPhp, mimetype: 'image/jpeg' } as any;
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      const file = { buffer: emptyBuffer, mimetype: 'image/jpeg' } as any;
      expect(() => pipe.transform(file)).toThrow(BadRequestException);
    });
  });
});
