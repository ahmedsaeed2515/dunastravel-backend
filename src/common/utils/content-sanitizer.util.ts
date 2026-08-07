import sanitizeHtml from 'sanitize-html';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

const HTML_ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    a: ['href', 'title'],
    span: ['title'],
    '*': ['title'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  disallowedTagsMode: 'discard',
};

const EMAIL_HTML_ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'align', 'title'],
    td: ['colspan', 'rowspan', 'align', 'width'],
    th: ['colspan', 'rowspan', 'align', 'width'],
    table: ['width', 'align'],
    '*': ['title', 'align', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
  disallowedTagsMode: 'discard',
};

/**
 * Sanitizes rich text with a strict allowlist. Built on `sanitize-html`
 * for zero-DOM, high-performance Node.js serverless execution.
 */
export function sanitizeHtmlContent(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, HTML_ALLOWLIST).trim();
}

export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
}

export function sanitizeEmailHtml(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, EMAIL_HTML_ALLOWLIST).trim();
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
