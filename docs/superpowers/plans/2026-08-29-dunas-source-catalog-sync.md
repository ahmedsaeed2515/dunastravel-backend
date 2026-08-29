# Dunas Source Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tour catalog exposed by the backend an exact normalized representation of the static programs in `DUNASTRAVEL-private-main/src/data`, while keeping operational booking and payment history intact.

**Architecture:** A source reader imports the source project's actual ESM data modules and resolves their translation keys into localized values. A normalizer converts every source shape into the existing Prisma `Tour`, `TourImage`, and `TourItinerary` model shape. A reconciliation runner produces a deterministic diff, writes a JSON backup/report before mutation, upserts every source tour by slug, and removes stale catalog visibility without deleting any tour with bookings.

**Tech Stack:** Node.js, TypeScript, ts-node, Prisma, PostgreSQL, Jest.

## Global Constraints

- `D:\@@project\LUXURY-PROJECT\DUNASTRAVEL-private-main\src\data` is the only source of truth for catalog content.
- Preserve `Booking`, payment, customer, review, and activity-history records.
- Never update prices from a UI file; retain the existing backend Egypt complimentary-pricing policy.
- Source catalog must contain exactly 55 unique public tour slugs unless the source inventory itself changes.
- Run in dry-run mode by default; `--execute` is the only mutation mode.
- Write generated reports under `reports/dunas-source-sync/`; do not overwrite user-authored files.
- The worktree contains unrelated edits. Do not make commits or stage files as part of this task.

---

### Task 1: Build a testable source inventory reader

**Files:**
- Create: `scripts/dunas-source-catalog.ts`
- Create: `src/scripts/dunas-source-catalog.spec.ts`
- Modify: `scripts/dunas-source-classification.ts`

**Interfaces:**
- Produces `loadDunasSourceCatalog(sourceDirectory): Promise<DunasRawCatalog>`.
- Produces `DunasRawCatalog.tours`, an array that carries source family and raw data for all 55 source rows.
- Consumes `buildDunasSourceClassifications()` for canonical country/category/destination classification.

- [ ] **Step 1: Write failing inventory tests**

```ts
it('loads every source family exactly once', async () => {
  const catalog = await loadDunasSourceCatalog(SOURCE_DATA_DIR);
  expect(catalog.tours).toHaveLength(55);
  expect(new Set(catalog.tours.map((tour) => tour.slug)).size).toBe(55);
  expect(catalog.tours.filter((tour) => tour.country === 'Egypt')).toHaveLength(12);
  expect(catalog.tours.filter((tour) => tour.country === 'Multi-Country')).toHaveLength(9);
});
```

- [ ] **Step 2: Run the inventory test and confirm it fails because the reader is absent**

Run: `npm test -- --runInBand src/scripts/dunas-source-catalog.spec.ts`

Expected: FAIL with module or export-not-found error.

- [ ] **Step 3: Implement the reader with native ESM imports**

```ts
export async function loadDunasSourceCatalog(sourceDirectory: string): Promise<DunasRawCatalog> {
  const [baseTours, turkeyTours, jordanTours, dubaiTours, multiCountryTours] = await Promise.all([
    readArrayExport(sourceDirectory, 'tours.js', 'tours'),
    readArrayExport(sourceDirectory, 'turkeyTours.js', 'turkeyTours'),
    readArrayExport(sourceDirectory, 'jordanTours.js', 'jordanTours'),
    readArrayExport(sourceDirectory, 'dubaiTours.js', 'dubaiTours'),
    readArrayExport(sourceDirectory, 'multiCountryTours.js', 'multiCountryTours'),
  ]);
  return attachCanonicalClassifications({ baseTours, turkeyTours, jordanTours, dubaiTours, multiCountryTours });
}
```

- [ ] **Step 4: Re-run the inventory test**

Run: `npm test -- --runInBand src/scripts/dunas-source-catalog.spec.ts`

Expected: PASS and exactly 55 unique source slugs.

### Task 2: Normalize detail-page content and locales

**Files:**
- Modify: `scripts/dunas-source-catalog.ts`
- Modify: `src/scripts/dunas-source-catalog.spec.ts`

**Interfaces:**
- Produces `normalizeDunasSourceTour(tour): NormalizedDunasTour`.
- `NormalizedDunasTour` exposes `titleJsonb`, `subtitleJsonb`, `overviewJsonb`, `highlightsJsonb`, `includedServicesJsonb`, `excludedServicesJsonb`, `hotelInfoJsonb`, `images`, and ordered `itinerary`.
- Consumes locale JSON files under `src/i18n/locales` to resolve keys such as `mct001.day1.desc`.

- [ ] **Step 1: Write failing full-detail tests**

```ts
it('resolves a multi-country itinerary instead of storing translation keys', async () => {
  const tour = await findNormalizedTour(SOURCE_DATA_DIR, 'essences-of-egypt-and-turkey-15-days');
  expect(tour.itinerary).toHaveLength(15);
  expect(tour.itinerary[0].description.en).not.toMatch(/^mct003\./);
  expect(tour.images[0].imageUrl).toBeTruthy();
});
```

- [ ] **Step 2: Run the detail tests and confirm they fail**

Run: `npm test -- --runInBand src/scripts/dunas-source-catalog.spec.ts`

Expected: FAIL because translation resolution and normalization are not implemented.

- [ ] **Step 3: Implement locale lookup and all source-shape adapters**

```ts
function resolveLocalizedValue(value: unknown, locale: SupportedLocale, dictionary: Record<string, unknown>): string {
  if (typeof value !== 'string') return '';
  return value.includes('.') ? String(getByPath(dictionary, `data.${value}`) ?? value) : value;
}

export function normalizeDunasSourceTour(tour: DunasRawTour, dictionaries: LocaleDictionaries): NormalizedDunasTour {
  return { ...mapPresentationFields(tour, dictionaries), images: normalizeImages(tour), itinerary: normalizeItinerary(tour, dictionaries) };
}
```

- [ ] **Step 4: Re-run detail and existing classification tests**

Run: `npm test -- --runInBand src/scripts/dunas-source-catalog.spec.ts src/scripts/dunas-source-classification.spec.ts`

Expected: PASS; no normalized display value begins with a source translation key prefix (`mct`, `completoEgypt`).

### Task 3: Implement protected catalog reconciliation

**Files:**
- Create: `scripts/sync-dunas-source-catalog.ts`
- Create: `src/scripts/sync-dunas-source-catalog.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces CLI command `npm run tours:sync-dunas-source -- --source=<absolute-source-data-dir> [--execute]`.
- Produces report fields `{ sourceTourCount, created, updated, unchanged, archived, protectedFromDeletion, fieldDiffs }`.
- Consumes `NormalizedDunasTour[]` from Task 2.

- [ ] **Step 1: Write failing reconciliation policy tests**

```ts
it('archives a stale unbooked tour but preserves a stale booked tour', async () => {
  const result = await reconcileCatalog(prisma, sourceCatalog, { execute: true });
  expect(result.archived).toContain('obsolete-unbooked-tour');
  expect(result.protectedFromDeletion).toContain('booked-historical-tour');
});
```

- [ ] **Step 2: Run the reconciliation-policy test and confirm it fails**

Run: `npm test -- --runInBand src/scripts/sync-dunas-source-catalog.spec.ts`

Expected: FAIL because `reconcileCatalog` is absent.

- [ ] **Step 3: Implement dry-run reports, atomic upserts, child replacement, and guarded archive behavior**

```ts
await tx.tour.upsert({
  where: { slug: source.slug },
  create: toTourCreateInput(source),
  update: toTourUpdateInput(source),
});
await tx.tourImage.deleteMany({ where: { tourId } });
await tx.tourItinerary.deleteMany({ where: { tourId } });
await tx.tourImage.createMany({ data: toImageRows(tourId, source.images) });
await tx.tourItinerary.createMany({ data: toItineraryRows(tourId, source.itinerary) });
```

For an existing database tour absent from the source, hard-delete it only when it has no bookings, reviews, favorites, activity logs, or availability references. Otherwise set `deletedAt`, `isActive: false`, and `status: 'ARCHIVED'`, and list it in `protectedFromDeletion`.

- [ ] **Step 4: Re-run the policy tests**

Run: `npm test -- --runInBand src/scripts/sync-dunas-source-catalog.spec.ts`

Expected: PASS; booking-linked rows are never deleted.

### Task 4: Reconcile destination pages and validate public API parity

**Files:**
- Modify: `scripts/sync-dunas-source-catalog.ts`
- Modify: `src/scripts/sync-dunas-source-catalog.spec.ts`
- Modify: `src/modules/tours/tours.service.spec.ts` only if a canonical field is not already exposed

**Interfaces:**
- Produces exactly one destination landing-page link per source tour using its canonical `destinationSlug`.
- Produces `/api/tours` and `/api/tours/:slug` DTOs with normalized images, itinerary, included/excluded lists, localized text, country, and category.

- [ ] **Step 1: Write failing API/detail parity assertions**

```ts
expect(detail.slug).toBe(source.slug);
expect(detail.images).toEqual(source.images);
expect(detail.itinerary).toHaveLength(source.itinerary.length);
expect(detail.included).toEqual(source.includedServicesJsonb.en);
expect(detail.country).toBe(source.country);
```

- [ ] **Step 2: Run the focused API tests and confirm any missing DTO field**

Run: `npm test -- --runInBand src/modules/tours/tours.service.spec.ts src/scripts/sync-dunas-source-catalog.spec.ts`

Expected: Any mismatch reports its slug and field path.

- [ ] **Step 3: Add landing-page relation reconciliation and only the missing response mappings**

```ts
await tx.tourLandingPageTour.deleteMany({ where: { tourId, landingPage: { type: 'DESTINATION' } } });
await tx.tourLandingPageTour.create({ data: { tourId, landingPageId, sortOrder: 0, isVisible: true, isFeatured: false } });
```

- [ ] **Step 4: Run focused tests, then run type-check and build**

Run: `npm test -- --runInBand src/scripts/dunas-source-catalog.spec.ts src/scripts/sync-dunas-source-catalog.spec.ts src/modules/tours/tours.service.spec.ts`

Run: `npm run typecheck`

Run: `npm run build`

Expected: all commands exit 0.

### Task 5: Execute only after reviewing the generated dry-run report

**Files:**
- Create at runtime: `reports/dunas-source-sync/<timestamp>-dry-run.json`
- Create at runtime: `reports/dunas-source-sync/<timestamp>-execute.json`

**Interfaces:**
- Consumes the Task 3 CLI and writes machine-readable evidence before and after mutation.

- [ ] **Step 1: Generate and inspect the dry-run report**

Run: `npx ts-node -r tsconfig-paths/register scripts/sync-dunas-source-catalog.ts --source="D:\@@project\LUXURY-PROJECT\DUNASTRAVEL-private-main\src\data" --report="reports/dunas-source-sync/dry-run.json"`

Expected: `sourceTourCount: 55`, field-level differences for every changed source-owned field, and no database mutation.

- [ ] **Step 2: Execute the catalog-only synchronization**

Run: `npx ts-node -r tsconfig-paths/register scripts/sync-dunas-source-catalog.ts --execute --source="D:\@@project\LUXURY-PROJECT\DUNASTRAVEL-private-main\src\data" --report="reports/dunas-source-sync/execute.json"`

Expected: all 55 source tours exist, and any stale booking-linked tour is archived rather than deleted.

- [ ] **Step 3: Verify the live list and representative detail pages**

Run: `Invoke-RestMethod 'https://dunastravel-backend-seven.vercel.app/api/tours?limit=100'`

Expected: public deployment is checked only after deployment; local DB changes alone do not update the hosted endpoint. Verify `complete-egypt-8d`, `journey-of-the-holy-family-10-days`, `essences-of-egypt-and-turkey-15-days`, and `jewels-of-egypt-and-jordan-11-days` through the local API first.

## Plan Self-Review

- Coverage: source inventory, static-detail normalization, translation resolution, full field diffs, safe upsert/delete handling, landing-page mapping, API DTO parity, and execution evidence are assigned to Tasks 1-5.
- Safety: all mutations are gated behind `--execute`; booking-linked historical tours are never hard-deleted.
- Scope: frontend and dashboard consumption remain a separate implementation plan after this backend catalog is proven correct.
