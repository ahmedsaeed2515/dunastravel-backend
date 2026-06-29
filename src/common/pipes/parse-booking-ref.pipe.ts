import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseBookingRefPipe implements PipeTransform {
  transform(value: string) {
    if (!/^BKG-[A-Z0-9]{6}$/.test(value)) {
      throw new BadRequestException('Invalid booking reference format');
    }
    return value;
  }
}
