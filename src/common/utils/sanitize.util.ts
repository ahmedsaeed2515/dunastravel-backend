import { sanitizePlainText } from './content-sanitizer.util';

export function sanitizeString(input: string): string {
  if (!input) return input;
  return sanitizePlainText(input);
}

/**
 * Prevents CSV formula injection (Excel/LibreOffice).
 * Prefixes cells starting with =, +, -, @, TAB or CR with a single quote.
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
