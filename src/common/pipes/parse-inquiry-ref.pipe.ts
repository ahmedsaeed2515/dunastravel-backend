import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseInquiryRefPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const normalized = value?.trim().toUpperCase();
    if (!/^INQ-[A-Z0-9]{6}$/.test(normalized)) {
      throw new BadRequestException('Invalid inquiry reference format');
    }
    return normalized;
  }
}
