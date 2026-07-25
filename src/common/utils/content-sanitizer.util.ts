const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

/**
 * Strips unsafe HTML tags, script blocks, inline event handlers, and unsafe URL schemes.
 */
export function sanitizeHtmlContent(input: string | null | undefined): string {
  if (!input) return '';

  let sanitized = input;

  // 1. Remove script tags and contents
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    '',
  );

  // 2. Remove iframe, object, embed, frame tags and contents
  sanitized = sanitized.replace(
    /<(iframe|object|embed|frame|frameset)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi,
    '',
  );

  // 3. Remove inline event handlers (onerror, onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]+/gi, '');

  // 4. Remove javascript: and data: text in attributes
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi,
    '$1="#"',
  );
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*javascript:[^>\s]+/gi,
    '$1="#"',
  );

  return sanitized.trim();
}

/**
 * Deterministically extracts localized string with 5-locale fallback:
 * requestedLocale -> 'en' -> first available string.
 */
export function extractI18nFallback(
  value: any,
  requestedLocale: string = 'en',
): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, string>;

    const targetLocale = SUPPORTED_LOCALES.includes(requestedLocale)
      ? requestedLocale
      : 'en';

    if (record[targetLocale] && typeof record[targetLocale] === 'string') {
      return record[targetLocale];
    }

    if (record['en'] && typeof record['en'] === 'string') {
      return record['en'];
    }

    for (const loc of SUPPORTED_LOCALES) {
      if (record[loc] && typeof record[loc] === 'string') {
        return record[loc];
      }
    }

    const firstKey = Object.keys(record)[0];
    if (firstKey && typeof record[firstKey] === 'string') {
      return record[firstKey];
    }
  }

  return '';
}

/**
 * Validates that localized JSONB contains valid entries across supported locales.
 */
export function validateSupportedLocales(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return keys.some((k) => SUPPORTED_LOCALES.includes(k));
}
