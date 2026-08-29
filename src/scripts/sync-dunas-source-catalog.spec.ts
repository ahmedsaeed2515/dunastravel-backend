import { orderBySourceCatalogId, staleTourAction } from '../../scripts/sync-dunas-source-catalog';

describe('staleTourAction', () => {
  it('archives historical tours with operational references', () => {
    expect(staleTourAction({ bookings: 1, reviews: 0, favorites: 0, activityLogs: 0, availabilities: 0, journeyRoutes: 0 }))
      .toBe('archive');
  });

  it('deletes source-orphan tours only when they have no operational references', () => {
    expect(staleTourAction({ bookings: 0, reviews: 0, favorites: 0, activityLogs: 0, availabilities: 0, journeyRoutes: 0 }))
      .toBe('delete');
  });

  it('reorders source-id swaps so a held identifier is released before reuse', () => {
    const ordered = orderBySourceCatalogId(
      [
        { slug: 'hurghada-escape', sourceCatalogId: 'ahmed-group-19' },
        { slug: 'sharm-el-sheikh-escape', sourceCatalogId: 'ahmed-group-20' },
      ],
      new Map([
        ['hurghada-escape', 'ahmed-group-18'],
        ['sharm-el-sheikh-escape', 'ahmed-group-19'],
      ]),
    );

    expect(ordered.map((tour) => tour.slug)).toEqual([
      'sharm-el-sheikh-escape',
      'hurghada-escape',
    ]);
  });
});
