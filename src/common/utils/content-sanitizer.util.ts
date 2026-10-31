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
  allowVulnerableTags: true, // Needed solely for <style> tag preservation in responsive email clients
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
    'style',
  ],
  allowedAttributes: {
    html: ['lang', 'dir'],
    meta: ['charset', 'name', 'content'],
    a: ['href', 'title', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'width', 'height', 'align', 'title', 'style'],
    td: ['colspan', 'rowspan', 'align', 'width', 'style'],
    th: ['colspan', 'rowspan', 'align', 'width', 'style'],
    table: ['width', 'align', 'cellpadding', 'cellspacing', 'border', 'style'],
    div: ['style', 'class', 'dir', 'align'],
    span: ['style', 'class'],
    p: ['style', 'class', 'dir', 'align'],
    '*': ['title', 'align', 'width', 'height', 'style', 'dir', 'lang'],
  },
  allowedStyles: {
    '*': {
      color: [/.*/],
      background: [/.*/],
      'background-color': [/.*/],
      'font-size': [/.*/],
      'font-family': [/.*/],
      'font-weight': [/.*/],
      'text-align': [/.*/],
      padding: [/.*/],
      'padding-top': [/.*/],
      'padding-bottom': [/.*/],
      'padding-left': [/.*/],
      'padding-right': [/.*/],
      margin: [/.*/],
      border: [/.*/],
      'border-radius': [/.*/],
      'line-height': [/.*/],
      'max-width': [/.*/],
      width: [/.*/],
      display: [/.*/],
      'text-decoration': [/.*/],
    },
  },
  // Strict scheme restrictions: data: is permitted ONLY on <img> tags, never on <a> links
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  disallowedTagsMode: 'discard',
};

/**
 * Strips dangerous CSS vectors from style blocks:
 * - @import (remote style injection)
 * - expression() (IE dynamic script execution)
 * - behavior: (IE HTC script execution)
 * - -moz-binding (Firefox XBL script execution)
 * - javascript:/vbscript:/data: in url(...)
 */
export function sanitizeCssContent(css: string): string {
  if (!css) return '';
  return css
    .replace(/@import\s+[^;]+;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/-moz-binding\s*:[^;]+;?/gi, '')
    .replace(
      /url\s*\(\s*(['"]?)\s*(?:javascript|vbscript|data):.*?\1\s*\)/gi,
      '',
    )
    .replace(/<\/style/gi, '<\\/style');
}

/**
 * Sanitizes email subjects to prevent CRLF / header injection attacks.
 */
export function sanitizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  return (
    subject
      // eslint-disable-next-line no-control-regex
      .replace(/[\r\n\x00-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

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

  // Clean style blocks to eliminate CSS script execution vectors
  const preProcessed = input.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_, css) => {
      return `<style>${sanitizeCssContent(css)}</style>`;
    },
  );

  return sanitizeHtml(preProcessed, EMAIL_HTML_ALLOWLIST).trim();
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
