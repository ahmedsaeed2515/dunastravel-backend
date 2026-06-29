import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseInvoiceNumberPipe implements PipeTransform {
  transform(value: string) {
    if (!/^INV-\d{4}-\d+$/.test(value)) {
      throw new BadRequestException('Invalid invoice number format');
    }
    return value;
  }
}
