import { AdminService } from './admin.service';

describe('AdminService.moveTour', () => {
  it('replaces only destination memberships while preserving a successful atomic move', async () => {
    const tx = {
      tour: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'tour-1', category: 'Classic' }),
        update: jest.fn().mockResolvedValue({ slug: 'nile-tour' }),
      },
      tourLandingPage: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'egypt-page', slug: 'egypt' }),
      },
      tourLandingPageTour: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 7 } }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'relation-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const cache = { del: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminService(prisma as any, cache as any, {} as any);

    await expect(
      service.moveTour(
        'nile-tour',
        {
          destinationSlug: 'egypt',
          country: 'Egypt',
          city: 'Luxor',
          category: 'Nile Cruise',
        },
        'admin-1',
      ),
    ).resolves.toEqual({
      success: true,
      slug: 'nile-tour',
      destinationSlug: 'egypt',
    });

    expect(tx.tourLandingPageTour.deleteMany).toHaveBeenCalledWith({
      where: { tourId: 'tour-1', landingPage: { type: 'DESTINATION' } },
    });
    expect(tx.tourLandingPageTour.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        landingPageId: 'egypt-page',
        tourId: 'tour-1',
        sortOrder: 8,
        isVisible: true,
      }),
    });
    expect(tx.tour.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country: 'Egypt',
          city: 'Luxor',
          category: 'Nile Cruise',
        }),
      }),
    );
  });
});
