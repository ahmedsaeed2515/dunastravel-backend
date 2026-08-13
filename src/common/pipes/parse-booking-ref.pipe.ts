import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseBookingRefPipe implements PipeTransform {
  transform(value: string) {
    if (!value || typeof value !== 'string' || value.trim().length > 20) {
      throw new BadRequestException('Invalid booking reference format: must not exceed 20 characters');
    }
    return value.trim();
  }
}
