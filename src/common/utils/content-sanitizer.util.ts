import DOMPurify, { Config, WindowLike } from 'dompurify';
import { JSDOM } from 'jsdom';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

const windowLike = new JSDOM('').window as unknown as WindowLike;
const purifier = DOMPurify(windowLike);

const HTML_ALLOWLIST: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'a',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['style', 'script', 'svg', 'math', 'template'],
  FORBID_ATTR: ['style', 'srcset', 'id', 'name'],
};

const EMAIL_HTML_ALLOWLIST: Config = {
  ALLOWED_TAGS: [
    'html',
    'head',
    'meta',
    'title',
    'body',
    'div',
    'span',
    'p',
    'br',
    'hr',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'h1',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'a',
    'img',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'target',
    'rel',
    'src',
    'alt',
    'width',
    'height',
    'align',
    'colspan',
    'rowspan',
  ],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'svg',
    'math',
  ],
  FORBID_ATTR: ['style', 'srcset', 'id', 'name', 'formaction'],
};

/**
 * Sanitizes rich text with a strict allowlist. Parsing via JSDOM/DOMPurify is
 * intentional: regular expressions cannot safely parse adversarial HTML.
 */
export function sanitizeHtmlContent(input: string | null | undefined): string {
  if (!input) return '';
  return String(purifier.sanitize(input, HTML_ALLOWLIST)).trim();
}

export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return '';
  return String(
    purifier.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    }),
  ).trim();
}

export function sanitizeEmailHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(purifier.sanitize(input, EMAIL_HTML_ALLOWLIST)).trim();
}

export function sanitizeEmailTemplateHtml(
  input: string | null | undefined,
): string {
  if (!input) return '';
  const tokens = new Map<string, string>();
  let index = 0;
  const protectedHtml = input.replace(
    /{{([A-Za-z][A-Za-z0-9_]*)}}/g,
    (token) => {
      const placeholder = `https://placeholder.invalid/__template_var_${index++}__`;
      tokens.set(placeholder, token);
      return placeholder;
    },
  );
  let sanitized = sanitizeEmailHtml(protectedHtml);
  for (const [placeholder, token] of tokens) {
    sanitized = sanitized.split(placeholder).join(token);
  }
  return sanitized;
}

/**
 * Deterministically extracts localized string with 5-locale fallback:
 * requestedLocale -> 'en' -> first available string.
 */
export function extractI18nFallback(
  value: unknown,
  requestedLocale: string = 'en',
): string {
  if (!value) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const targetLocale = SUPPORTED_LOCALES.includes(requestedLocale)
      ? requestedLocale
      : 'en';

    const preferred = record[targetLocale];
    if (typeof preferred === 'string') return preferred;
    if (typeof record.en === 'string') return record.en;

    for (const locale of SUPPORTED_LOCALES) {
      if (typeof record[locale] === 'string') return record[locale];
    }

    const firstValue = Object.values(record).find(
      (entry): entry is string => typeof entry === 'string',
    );
    return firstValue ?? '';
  }

  return '';
}

export function validateSupportedLocales(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([locale, text]) =>
      SUPPORTED_LOCALES.includes(locale) && typeof text === 'string',
  );
}
