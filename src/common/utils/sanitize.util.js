"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = sanitizeString;
exports.sanitizeCsvField = sanitizeCsvField;
function sanitizeString(input) {
    if (!input)
        return input;
    // Strip all HTML tags and trim
    return input.replace(/<[^>]*>?/gm, '').trim();
}
/**
 * Prevents CSV formula injection (Excel/LibreOffice).
 * Prefixes cells starting with =, +, -, @, TAB or CR with a single quote.
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */
function sanitizeCsvField(value) {
    if (value === null || value === undefined)
        return '';
    var str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
        return "'".concat(str);
    }
    return str;
}
