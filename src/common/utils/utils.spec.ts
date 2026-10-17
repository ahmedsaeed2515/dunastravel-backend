import {
  extractI18n,
  extractI18nList,
  getPaginationParams,
  paginate,
  generateReferenceCode,
  generateInvoiceNumber,
} from './index';

describe('Common Utils', () => {
  describe('extractI18n', () => {
    const mockJsonb = {
      en: 'English Title',
      es: 'Spanish Title',
      ar: 'Arabic Title',
    };

    it('should return requested language string if present', () => {
      expect(extractI18n(mockJsonb, 'es')).toBe('Spanish Title');
      expect(extractI18n(mockJsonb, 'ar')).toBe('Arabic Title');
    });

    it('should fallback to English (en) if requested language is missing', () => {
      expect(extractI18n(mockJsonb, 'fr')).toBe('English Title');
    });

    it('should return empty string if jsonb is null or undefined', () => {
      expect(extractI18n(null, 'en')).toBe('');
      expect(extractI18n(undefined, 'en')).toBe('');
    });
  });

  describe('extractI18nList', () => {
    it('returns the requested localized list without flattening commas', () => {
      expect(
        extractI18nList(
          {
            en: ['Breakfast, taxes and transfers'],
            ar: ['الإفطار والانتقالات'],
          },
          'en',
        ),
      ).toEqual(['Breakfast, taxes and transfers']);
    });

    it('falls back to English and supports legacy newline-delimited text', () => {
      expect(extractI18nList({ en: 'Breakfast\nTransfers' }, 'it')).toEqual([
        'Breakfast',
        'Transfers',
      ]);
    });
  });

  describe('getPaginationParams', () => {
    it('should calculate skip and take correctly for standard page and limit', () => {
      const result = getPaginationParams(2, 10);
      expect(result).toEqual({ page: 2, limit: 10, skip: 10, take: 10 });
    });

    it('should default to page 1 and limit 10 if invalid values provided', () => {
      const result = getPaginationParams(0, -5);
      expect(result).toEqual({ page: 1, limit: 1, skip: 0, take: 1 });
    });

    it('should cap max limit to 100', () => {
      const result = getPaginationParams(1, 500);
      expect(result).toEqual({ page: 1, limit: 100, skip: 0, take: 100 });
    });
  });

  describe('paginate', () => {
    it('should structure paginated response correctly', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const total = 25;
      const result = paginate(items, total, 2, 10);

      expect(result).toEqual({
        data: items,
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPrevPage: true,
        },
      });
    });
  });

  describe('Generators', () => {
    it('generateReferenceCode should return BKG- prefixed uppercase alphanumeric string', () => {
      const ref = generateReferenceCode();
      expect(ref).toMatch(/^BKG-[A-Z0-9]{6}$/);
    });

    it('generateInvoiceNumber should return INV-YYYY- prefix', () => {
      const year = new Date().getFullYear();
      const inv = generateInvoiceNumber(year, 1);
      expect(inv).toMatch(new RegExp(`^INV-${year}-[0-9]{3,4}$`));
    });
  });
});
