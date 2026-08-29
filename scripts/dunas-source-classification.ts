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

export function sourceSlug(tour: DunasSourceTour): string {
  const normalize = (value: string): string => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (tour.slug?.trim()) return normalize(tour.slug);

  const title = typeof tour.title === 'string'
    ? tour.title
    : tour.title?.en ?? (typeof tour.name === 'string' ? tour.name : tour.name?.en);
  const slug = normalize([tour.id, title].filter((value): value is string => Boolean(value?.trim())).join('-'));
  if (!slug) throw new Error('Dunas source tour is missing a slug');
  return slug;
}

function add(target: DunasSourceClassification[], seen: Set<string>, item: DunasSourceClassification): void {
  if (seen.has(item.slug)) throw new Error(`Duplicate source slug: ${item.slug}`);
  seen.add(item.slug);
  target.push(item);
}

export function buildDunasSourceClassifications(catalog: DunasSourceCatalog): DunasSourceClassification[] {
  const output: DunasSourceClassification[] = [];
  const seen = new Set<string>();

  for (const tour of catalog.baseTours) {
    const mapped = tour.destination ? BASE_DESTINATIONS[tour.destination.trim().toLowerCase()] : undefined;
    const rawCategory = tour.type?.trim() || tour.category?.trim();
    const category = rawCategory ? CATEGORY_LABEL_BY_SOURCE_KEY[rawCategory] ?? rawCategory : undefined;
    if (!mapped || !category) throw new Error(`Unsupported base tour classification: ${sourceSlug(tour)}`);
    add(output, seen, { slug: sourceSlug(tour), category, ...mapped });
  }

  for (const tour of catalog.turkeyTours) {
    add(output, seen, { slug: sourceSlug(tour), country: 'Turkey', category: 'Turkey', destinationSlug: 'turkey' });
  }
  for (const tour of catalog.jordanTours) {
    add(output, seen, { slug: sourceSlug(tour), country: 'Jordan', category: 'Jordan', destinationSlug: 'jordan' });
  }
  for (const tour of catalog.dubaiTours) {
    add(output, seen, {
      slug: sourceSlug(tour),
      country: 'United Arab Emirates',
      category: tour.id?.trim().toUpperCase().startsWith('HM') ? 'Honeymoon' : 'United Arab Emirates',
      destinationSlug: 'dubai',
    });
  }
  for (const tour of catalog.multiCountryTours) {
    add(output, seen, { slug: sourceSlug(tour), country: 'Multi-Country', category: 'Multi-Country', destinationSlug: 'multi-country' });
  }
  for (const tour of catalog.additionalEgyptTours) {
    add(output, seen, { slug: tour.slug, country: 'Egypt', category: tour.category, destinationSlug: 'egypt' });
  }
  return output;
}
