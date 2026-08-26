# Ahmed Full-Fidelity Import Report

Generated: 2026-08-26

## Controlled replacement result

| Measure | Result |
| --- | ---: |
| Canonical source tours | 56 |
| Existing records updated in place | 56 |
| New records created | 0 |
| Import errors | 0 |
| Published / active canonical tours | 22 |
| Draft canonical tours | 34 |
| Existing booking references retained during import | 51 |
| Destination relations replaced | 56 |
| Availability records fabricated by import | 0 |

The importer replaced canonical scalar fields, localized content, structured source presentation fields, ordered itinerary rows, media rows, and destination relations. It did not mutate bookings, payments, invoices, customers, reviews, favorites, or audit history.

## Legacy catalog handling

All six non-Ahmed records were already archived. Each had historical audit, booking, review, favorite, availability, or route dependencies, so none was hard-deleted. The safe-prune invariant passed: **0 public non-Ahmed tours**.

| Historical legacy records retained | Reason |
| --- | --- |
| `bsfgbsgf`, `cairo-expressm-4d`, `turquia-legendaria-11d` | audit/activity history |
| `jewels-of-jordan`, `passion-of-turkey`, `wonders-of-egypt` | booking history (and, where applicable, reviews/favorites/audit history) |

## Database parity verification

`ahmed-full-fidelity-verification.json` queried the live configured PostgreSQL database after replacement.

| Check | Result |
| --- | ---: |
| Imported canonical tours | 56 |
| Total database tours | 62 |
| Canonical itinerary rows | 467 |
| Canonical media rows | 23 |
| Canonical destination relations | 56 |
| Public non-Ahmed tours | 0 |
| Field mismatches | 0 |

## Recovery evidence

- Pre-rebuild database snapshot: `reports/before-ahmed-rebuild/tour-catalog-snapshot-20260826T2015Z.json`
- Canonical full-fidelity source snapshot: `reports/before-ahmed-rebuild/canonical-full-fidelity-source-20260826T2038Z.json`
- Machine-readable execution report: `reports/ahmed-full-fidelity-import-report.json`
- Machine-readable post-import verifier: `reports/ahmed-full-fidelity-verification.json`
