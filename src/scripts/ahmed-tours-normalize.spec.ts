import {
  deriveBasePrice,
  groupAhmedTranslations,
  validateCatalog,
} from '../../scripts/ahmed-tours/normalize';

describe('Ahmed tour normalization', () => {
  it('derives the lowest published double-room rate without using supplements', () => {
    expect(
      deriveBasePrice({
        pricing: {
          winter: [{ dbl: 999, sgl: 400 }],
          summer: [{ dbl: 799, sgl: 280 }],
        },
      }),
    ).toBe(799);
  });

  it('prefers an explicit positive package price', () => {
    expect(
      deriveBasePrice({
        price: 600,
        pricing: { winter: [{ dbl: 999 }] },
      }),
    ).toBe(600);
  });

  it('ignores an exact duplicate locale row inside a translation group', () => {
    const base = {
      id: '1',
      slug: 'same-tour',
      title: 'Same tour',
      duration: '1 day',
      type: 'Tour',
      groupSize: '2',
      overview: 'Overview',
      highlights: [],
      itinerary: [],
      included: [],
      excluded: [],
    };
    const records = [
      { ...base, language: 'en' as const },
      { ...base, id: '2', language: 'en' as const },
      { ...base, id: '3', language: 'ar' as const, title: 'رحلة' },
    ];
    expect(groupAhmedTranslations(records)).toHaveLength(1);
    expect(groupAhmedTranslations(records)[0]).toHaveLength(2);
  });

  it('rejects duplicate normalized slugs', () => {
    const tour = {
      sourceId: 'source-1',
      sourceCodeJsonb: {},
      slug: 'valid-slug',
      titleJsonb: { en: 'Title' },
      subtitleJsonb: {},
      highlightsJsonb: {},
      departureInfoJsonb: {},
      market: null,
      sourceRating: null,
      sourceReviewCount: null,
      durationJsonb: {},
      overviewJsonb: {},
      minPaxJsonb: {},
      includedServicesJsonb: {},
      excludedServicesJsonb: {},
      category: 'Tour',
      country: 'Egypt',
      basePriceUsd: null,
      currency: 'USD' as const,
      status: 'DRAFT' as const,
      isActive: false,
      languages: ['en' as const],
      tags: [],
      hotelInfoJsonb: null,
      seasonPricingJsonb: null,
      transportationJsonb: null,
      termsJsonb: null,
      itineraries: [],
      images: [],
    };
    expect(() =>
      validateCatalog([tour, { ...tour, sourceId: 'source-2' }]),
    ).toThrow('Duplicate normalized slug');
  });
});
