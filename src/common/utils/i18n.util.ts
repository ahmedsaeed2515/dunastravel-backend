export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt', 'it', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function extractI18n(
  jsonb: unknown,
  lang: string,
  fallbackLang: string = 'en',
): string {
  if (jsonb === null || jsonb === undefined) {
    return '';
  }

  if (typeof jsonb === 'string') {
    return jsonb;
  }

  if (typeof jsonb === 'object' && !Array.isArray(jsonb)) {
    const obj = jsonb as Record<string, unknown>;

    if (Object.keys(obj).length === 0) {
      return '';
    }

    const valLang = obj[lang];
    if (
      valLang !== undefined &&
      valLang !== null &&
      String(valLang).trim() !== ''
    ) {
      return String(valLang);
    }

    const valFallback = obj[fallbackLang];
    if (
      valFallback !== undefined &&
      valFallback !== null &&
      String(valFallback).trim() !== ''
    ) {
      return String(valFallback);
    }

    const valEn = obj['en'];
    if (valEn !== undefined && valEn !== null && String(valEn).trim() !== '') {
      return String(valEn);
    }

    const values = Object.values(obj);
    for (const val of values) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val);
      }
    }
  }

  return typeof jsonb === 'number' || typeof jsonb === 'boolean'
    ? String(jsonb)
    : '';
}

export function extractI18nList(
  jsonb: unknown,
  lang: string,
  fallbackLang: string = 'en',
): string[] {
  if (jsonb === null || jsonb === undefined) return [];

  // 1. Array of localized objects [ { ar: '...', en: '...' } ] or strings [ '...' ]
  if (Array.isArray(jsonb)) {
    return jsonb
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object' && item !== null) {
          return extractI18n(item, lang, fallbackLang);
        }
        return '';
      })
      .filter((item) => typeof item === 'string' && item.trim().length > 0);
  }

  // 2. Multiline or comma-separated string
  if (typeof jsonb === 'string') {
    return jsonb
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  // 3. Object with language keys { ar: [...], en: [...], es: [...], pt: [...], it: [...] }
  if (typeof jsonb === 'object') {
    const record = jsonb as Record<string, unknown>;
    for (const locale of [lang, fallbackLang, 'en', ...Object.keys(record)]) {
      const val = record[locale];
      if (Array.isArray(val)) {
        return val
          .map((item) =>
            typeof item === 'string'
              ? item.trim()
              : extractI18n(item, lang, fallbackLang),
          )
          .filter(Boolean);
      }
      if (typeof val === 'string' && val.trim()) {
        return val
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  return [];
}
