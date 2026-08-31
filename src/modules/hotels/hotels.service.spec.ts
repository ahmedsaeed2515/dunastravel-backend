import { HotelsService } from './hotels.service';

describe('HotelsService', () => {
  const hotel = {
    id: '0df2fd5d-35d0-41a5-a173-74e646ed9d44',
    slug: 'nile-palace-luxor',
    nameJsonb: { en: 'Nile Palace Luxor', ar: 'قصر النيل' },
    descriptionJsonb: { en: 'A verified hotel record.' },
    destinationSlug: 'luxor',
    city: 'Luxor',
    stars: 5,
    rating: { toString: () => '4.7' },
    currency: 'USD',
    addressJsonb: null,
    amenitiesJsonb: ['pool'],
    policiesJsonb: null,
    heroMediaId: null,
    status: 'PUBLISHED',
    isActive: true,
    sortOrder: 0,
    rooms: [],
    createdAt: new Date(),
  };

  it('only reads published and active hotels from the public catalog', async () => {
    const prisma = {
      hotel: { findMany: jest.fn().mockResolvedValue([hotel]) },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new HotelsService(prisma as never);

    await expect(service.findAllPublic('ar', 'luxor', 12)).resolves.toEqual([
      expect.objectContaining({ slug: 'nile-palace-luxor', name: 'قصر النيل', rating: 4.7 }),
    ]);
    expect(prisma.hotel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, status: 'PUBLISHED', isActive: true, destinationSlug: 'luxor' }),
      take: 12,
    }));
  });

  it('sanitizes localized admin input before creating a hotel', async () => {
    const prisma = {
      hotel: { create: jest.fn().mockResolvedValue({ id: hotel.id }) },
    };
    const service = new HotelsService(prisma as never);

    await service.createAdmin({
      slug: 'nile-palace-luxor',
      nameJsonb: { en: '<b>Nile Palace Luxor</b>' },
      destinationSlug: 'luxor',
      city: '<i>Luxor</i>',
      stars: 5,
      currency: 'USD',
    });

    expect(prisma.hotel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nameJsonb: { en: 'Nile Palace Luxor' },
        city: 'Luxor',
      }),
    }));
  });
});
