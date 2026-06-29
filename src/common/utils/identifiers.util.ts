import * as crypto from 'crypto';

export function generateReferenceCode(): string {
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
  return `BKG-${code}`;
}

export function generateInvoiceNumber(year: number, count: number): string {
  if (count < 1) {
    throw new Error('Invoice count must be ≥ 1');
  }
  const paddedCount = count.toString().padStart(3, '0');
  return `INV-${year}-${paddedCount}`;
}

export function generateInquiryReferenceCode(): string {
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
  return `INQ-${code}`;
}
