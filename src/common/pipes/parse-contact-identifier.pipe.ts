import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseContactIdentifierPipe
  implements PipeTransform<string, string>
{
  transform(value: string): string {
    const normalized = value?.trim().toUpperCase();
    if (
      !normalized ||
      (!/^[1-9]\d{0,9}$/.test(normalized) &&
        !/^CON-[A-Z0-9]{6}$/.test(normalized))
    ) {
      throw new BadRequestException(
        'Invalid contact submission identifier',
      );
    }
    return normalized;
  }
}
