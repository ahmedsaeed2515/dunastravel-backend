export interface DunasSourceTour {
  id?: string;
  slug?: string;
  title?: string | { en?: string };
  name?: string | { en?: string };
  destination?: string;
  type?: string;
  category?: string;
}

export interface DunasAdditionalEgyptTour {
  slug: string;
  category: string;
}

export interface DunasSourceCatalog {
  baseTours: DunasSourceTour[];
  turkeyTours: DunasSourceTour[];
  jordanTours: DunasSourceTour[];
  dubaiTours: DunasSourceTour[];
  multiCountryTours: DunasSourceTour[];
  additionalEgyptTours: DunasAdditionalEgyptTour[];
}

export interface DunasSourceClassification {
  slug: string;
  country: string;
  category: string;
  destinationSlug: string;
}

const BASE_DESTINATIONS: Record<string, { country: string; destinationSlug: string }> = {
  egypt: { country: 'Egypt', destinationSlug: 'egypt' },
  greece: { country: 'Greece', destinationSlug: 'greece' },
  morocco: { country: 'Morocco', destinationSlug: 'morocco' },
  tunisia: { country: 'Tunisia', destinationSlug: 'tunisia' },
};

const CATEGORY_LABEL_BY_SOURCE_KEY: Record<string, string> = {
  'completoEgypt.type': 'Complete Egypt Tour',
};

function requiredSlug(tour: DunasSourceTour): string {
  const normalizeSlug = (value: string): string => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = tour.slug?.trim();
  if (slug) return normalizeSlug(slug);

  const title = typeof tour.title === 'string'
    ? tour.title
    : tour.title?.en
      ?? (typeof tour.name === 'string' ? tour.name : tour.name?.en);
  const derived = normalizeSlug([tour.id, title]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('-'));
  if (!derived) throw new Error('Dunas source tour is missing a slug');
  return derived;
}

function add(
  target: DunasSourceClassification[],
  seen: Set<string>,
  classification: DunasSourceClassification,
): void {
  if (seen.has(classification.slug)) {
    throw new Error(`Duplicate source slug: ${classification.slug}`);
  }
  seen.add(classification.slug);
  target.push(classification);
}

/**
 * Maps the user-facing DUNASTRAVEL source files to the backend's canonical
 * country/category/destination fields. It deliberately excludes pricing,
 * publication state, and booking-related data.
 */
export function buildDunasSourceClassifications(
  catalog: DunasSourceCatalog,
): DunasSourceClassification[] {
  const classifications: DunasSourceClassification[] = [];
  const seen = new Set<string>();

  for (const tour of catalog.baseTours) {
    const slug = requiredSlug(tour);
    const destination = tour.destination?.trim().toLowerCase();
    const mapped = destination ? BASE_DESTINATIONS[destination] : undefined;
    const sourceCategory = tour.type?.trim() || tour.category?.trim();
    const category = sourceCategory && (CATEGORY_LABEL_BY_SOURCE_KEY[sourceCategory] ?? sourceCategory);
    if (!mapped || !category) {
      throw new Error(`Unsupported base tour classification: ${slug}`);
    }
    add(classifications, seen, { slug, category, ...mapped });
  }

  for (const tour of catalog.turkeyTours) {
    add(classifications, seen, {
      slug: requiredSlug(tour),
      country: 'Turkey',
      category: 'Turkey',
      destinationSlug: 'turkey',
    });
  }

  for (const tour of catalog.jordanTours) {
    add(classifications, seen, {
      slug: requiredSlug(tour),
      country: 'Jordan',
      category: 'Jordan',
      destinationSlug: 'jordan',
    });
  }

  for (const tour of catalog.dubaiTours) {
    const id = tour.id?.trim().toUpperCase() ?? '';
    add(classifications, seen, {
      slug: requiredSlug(tour),
      country: 'United Arab Emirates',
      category: id.startsWith('HM') ? 'Honeymoon' : 'United Arab Emirates',
      destinationSlug: 'dubai',
    });
  }

  for (const tour of catalog.multiCountryTours) {
    add(classifications, seen, {
      slug: requiredSlug(tour),
      country: 'Multi-Country',
      category: 'Multi-Country',
      destinationSlug: 'multi-country',
    });
  }

  for (const tour of catalog.additionalEgyptTours) {
    add(classifications, seen, {
      slug: tour.slug,
      country: 'Egypt',
      category: tour.category,
      destinationSlug: 'egypt',
    });
  }

  return classifications;
}
