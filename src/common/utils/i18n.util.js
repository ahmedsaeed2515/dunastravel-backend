"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_LANGUAGES = void 0;
exports.extractI18n = extractI18n;
/* eslint-disable @typescript-eslint/no-base-to-string */
exports.SUPPORTED_LANGUAGES = ['en', 'es', 'pt', 'it', 'ar'];
function extractI18n(jsonb, lang, fallbackLang) {
    if (fallbackLang === void 0) { fallbackLang = 'en'; }
    if (jsonb === null || jsonb === undefined) {
        return '';
    }
    if (typeof jsonb === 'string') {
        return jsonb;
    }
    if (typeof jsonb === 'object' && !Array.isArray(jsonb)) {
        var obj = jsonb;
        if (Object.keys(obj).length === 0) {
            return '';
        }
        var valLang = obj[lang];
        if (valLang !== undefined &&
            valLang !== null &&
            String(valLang).trim() !== '') {
            return String(valLang);
        }
        var valFallback = obj[fallbackLang];
        if (valFallback !== undefined &&
            valFallback !== null &&
            String(valFallback).trim() !== '') {
            return String(valFallback);
        }
        var valEn = obj['en'];
        if (valEn !== undefined && valEn !== null && String(valEn).trim() !== '') {
            return String(valEn);
        }
        var values = Object.values(obj);
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var val = values_1[_i];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val);
            }
        }
    }
    return String(jsonb);
}
