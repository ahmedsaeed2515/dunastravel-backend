import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SLUG = /^[a-z0-9]+(?:[-_]+[a-z0-9]+)*$/i;

@Injectable()
export class ParseUuidOrSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const normalized = value
      ?.trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '');
    if (
      !normalized ||
      normalized.length > 100 ||
      (!UUID_V4.test(normalized) && !SAFE_SLUG.test(normalized))
    ) {
      throw new BadRequestException('Invalid resource identifier');
    }
    return normalized;
  }
}
