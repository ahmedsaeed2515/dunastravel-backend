import {
  sanitizeHtmlContent,
  sanitizePlainText,
  sanitizeEmailHtml,
  sanitizeEmailTemplateHtml,
  extractI18nFallback,
  validateSupportedLocales,
} from './content-sanitizer.util';

describe('content-sanitizer.util', () => {
  describe('sanitizeHtmlContent', () => {
    it('should allow valid safe HTML tags and attributes', () => {
      const input =
        '<p>Hello <strong>World</strong> <a href="https://example.com" title="test">link</a></p>';
      const result = sanitizeHtmlContent(input);
      expect(result).toBe(
        '<p>Hello <strong>World</strong> <a href="https://example.com" title="test">link</a></p>',
      );
    });

    it('should strip malicious script tags', () => {
      const input = '<p>Safe</p><script>alert("xss")</script>';
      const result = sanitizeHtmlContent(input);
      expect(result).toBe('<p>Safe</p>');
    });

    it('should return empty string for null or undefined', () => {
      expect(sanitizeHtmlContent(null)).toBe('');
      expect(sanitizeHtmlContent(undefined)).toBe('');
    });
  });

  describe('sanitizePlainText', () => {
    it('should strip all HTML tags', () => {
      const input = '<h1>Title</h1><p>Paragraph with <a href="#">link</a></p>';
      const result = sanitizePlainText(input);
      expect(result).toBe('TitleParagraph with link');
    });

    it('should return empty string for null or undefined', () => {
      expect(sanitizePlainText(null)).toBe('');
    });
  });

  describe('sanitizeEmailHtml', () => {
    it('should preserve email layout elements like tables and images', () => {
      const input =
        '<table><tr><td><img src="https://img.com/a.jpg" alt="pic" />Text</td></tr></table>';
      const result = sanitizeEmailHtml(input);
      expect(result).toContain('<table>');
      expect(result).toContain('<img');
    });
  });

  describe('sanitizeEmailTemplateHtml', () => {
    it('should preserve {{var}} template tokens', () => {
      const input =
        '<div>Hello {{guestName}}, your booking {{bookingId}} is confirmed!</div>';
      const result = sanitizeEmailTemplateHtml(input);
      expect(result).toBe(
        '<div>Hello {{guestName}}, your booking {{bookingId}} is confirmed!</div>',
      );
    });
  });

  describe('extractI18nFallback', () => {
    it('should extract requested locale string', () => {
      const value = { en: 'Hello', ar: 'مرحبا' };
      expect(extractI18nFallback(value, 'ar')).toBe('مرحبا');
    });

    it('should fallback to English if target locale missing', () => {
      const value = { en: 'Hello', pt: 'Olá' };
      expect(extractI18nFallback(value, 'ar')).toBe('Hello');
    });
  });

  describe('validateSupportedLocales', () => {
    it('should return true for valid localized object', () => {
      expect(validateSupportedLocales({ en: 'Test' })).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(validateSupportedLocales(null)).toBe(false);
      expect(validateSupportedLocales('invalid')).toBe(false);
    });
  });
});
