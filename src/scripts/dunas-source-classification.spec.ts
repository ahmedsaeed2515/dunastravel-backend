import {
  buildDunasSourceClassifications,
  type DunasSourceCatalog,
} from '../../scripts/dunas-source-classification';

describe('Dunas source classifications', () => {
  const catalog: DunasSourceCatalog = {
    baseTours: [
      {
        id: 'tunisia-8d-7n-tour',
        slug: 'tunisia-8-days-desert-sea',
        destination: 'tunisia',
        type: 'Premium Experience',
      },
      {
        id: 'eg-br-001',
        slug: 'cairo-express-4d',
        destination: 'egypt',
        type: 'City Break',
      },
    ],
    turkeyTours: [{ id: 'REG-01', slug: 'reg-01-legendary-turkey' }],
    jordanTours: [{ id: 'REG-15', slug: 'reg-15-classic-jordan' }],
    dubaiTours: [
      { id: 'REG-22', slug: 'reg-22-stop-over-dubai' },
      { id: 'HM001', slug: 'hm001-honeymoon-in-dubai' },
    ],
    multiCountryTours: [{ id: 'mct-001', slug: 'estrellas-medio-oriente-19d' }],
    additionalEgyptTours: [
      { slug: 'journey-of-the-holy-family-10-days', category: 'Religious' },
      { slug: 'hurghada-escape', category: 'Beach' },
      { slug: 'sharm-el-sheikh-escape', category: 'Beach' },
    ],
  };

  it('preserves the source country and category for every catalog family', () => {
    const classifications = buildDunasSourceClassifications(catalog);

    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'tunisia-8-days-desert-sea',
          country: 'Tunisia',
          category: 'Premium Experience',
          destinationSlug: 'tunisia',
        }),
        expect.objectContaining({
          slug: 'reg-01-legendary-turkey',
          country: 'Turkey',
          category: 'Turkey',
          destinationSlug: 'turkey',
        }),
        expect.objectContaining({
          slug: 'hm001-honeymoon-in-dubai',
          country: 'United Arab Emirates',
          category: 'Honeymoon',
          destinationSlug: 'dubai',
        }),
        expect.objectContaining({
          slug: 'sharm-el-sheikh-escape',
          country: 'Egypt',
          category: 'Beach',
          destinationSlug: 'egypt',
        }),
      ]),
    );
  });

  it('rejects duplicate source slugs before any database write can happen', () => {
    expect(() =>
      buildDunasSourceClassifications({
        ...catalog,
        turkeyTours: [{ id: 'duplicate', slug: 'cairo-express-4d' }],
      }),
    ).toThrow('Duplicate source slug: cairo-express-4d');
  });

  it('derives the stable backend slug when a Dubai source record only has its id and localized title', () => {
    const classifications = buildDunasSourceClassifications({
      ...catalog,
      dubaiTours: [
        {
          id: 'REG-22',
          title: { en: 'Stop Over Dubai' },
        },
      ],
    });

    expect(classifications).toContainEqual({
      slug: 'reg-22-stop-over-dubai',
      country: 'United Arab Emirates',
      category: 'United Arab Emirates',
      destinationSlug: 'dubai',
    });
  });

  it('uses a localized name and normalizes repeated separators in source slugs', () => {
    const classifications = buildDunasSourceClassifications({
      ...catalog,
      jordanTours: [{ id: 'REG-20', slug: 'reg-20-jordan-extension---5-days' }],
      dubaiTours: [{ id: 'REG-23', name: { en: 'Dubai and Its History' } }],
    });

    expect(classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'reg-20-jordan-extension-5-days' }),
        expect.objectContaining({ slug: 'reg-23-dubai-and-its-history' }),
      ]),
    );
  });

  it('resolves a source category lookup key to the stored catalog label', () => {
    const classifications = buildDunasSourceClassifications({
      ...catalog,
      baseTours: [
        {
          id: 'eg-completo-001',
          slug: 'complete-egypt-8d',
          destination: 'egypt',
          type: 'completoEgypt.type',
        },
      ],
    });

    expect(classifications).toContainEqual(
      expect.objectContaining({
        slug: 'complete-egypt-8d',
        category: 'Complete Egypt Tour',
      }),
    );
  });
});
