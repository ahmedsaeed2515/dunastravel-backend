import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

export function generateReferenceCode(prefix: string = 'BKG'): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  while (code.length < 6) {
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < bytes.length; i++) {
      if (code.length < 6) {
        code += charset[bytes[i] % charset.length];
      }
    }
  }
  return `${prefix}-${code}`;
}

export function formatInvoiceNumber(
  year: number,
  sequence: number | string,
): string {
  const paddedCount = sequence.toString().padStart(4, '0');
  return `INV-${year}-${paddedCount}`;
}

export function generateInvoiceNumber(): string;
export function generateInvoiceNumber(year: number, count: number): string;
export function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
): Promise<string>;
export function generateInvoiceNumber(
  arg1?: number | Prisma.TransactionClient,
  arg2?: number,
): string | Promise<string> {
  const currentYear = new Date().getFullYear();
  if (arg1 === undefined) {
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `INV-${currentYear}-${randomSuffix}`;
  }
  if (typeof arg1 === 'number') {
    if (arg2 !== undefined && arg2 < 1) {
      throw new Error('Invoice count must be ≥ 1');
    }
    return formatInvoiceNumber(arg1, arg2 || 1);
  }

  return (async () => {
    const res = await arg1.$queryRaw<{ nextval: bigint | number | string }[]>`
      SELECT nextval('invoice_seq') AS nextval
    `;
    if (
      !res ||
      res.length === 0 ||
      res[0]?.nextval === undefined ||
      res[0]?.nextval === null
    ) {
      throw new Error(
        'Failed to generate invoice sequence: nextval returned empty result',
      );
    }
    const val = res[0].nextval;
    const countVal = typeof val === 'bigint' ? val.toString() : Number(val);
    return formatInvoiceNumber(currentYear, countVal);
  })();
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
