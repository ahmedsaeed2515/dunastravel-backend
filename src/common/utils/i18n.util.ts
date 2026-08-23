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
  const normalize = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/\r?\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  if (Array.isArray(jsonb) || typeof jsonb === 'string') return normalize(jsonb);
  if (typeof jsonb !== 'object') return [];
  const record = jsonb as Record<string, unknown>;
  for (const locale of [lang, fallbackLang, 'en', ...Object.keys(record)]) {
    const result = normalize(record[locale]);
    if (result.length > 0) return result;
  }
  return [];
}
