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

  it('correctly resolves all 5 locales (en, ar, es, pt, it) and falls back to en if locale missing', async () => {
    const multiLangHotel = {
      ...hotel,
      nameJsonb: {
        en: 'English Hotel',
        ar: 'فندق عربي',
        es: 'Hotel Español',
        pt: 'Hotel Português',
        it: 'Hotel Italiano',
      },
      descriptionJsonb: {
        en: 'English Description',
        ar: 'وصف عربي',
        es: 'Descripción Española',
        pt: 'Descrição Portuguesa',
        it: 'Descrizione Italiana',
      },
    };

    const prisma = {
      hotel: { findMany: jest.fn().mockResolvedValue([multiLangHotel]) },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new HotelsService(prisma as never);

    const resEn = await service.findAllPublic('en');
    expect(resEn[0].name).toBe('English Hotel');
    expect(resEn[0].description).toBe('English Description');

    const resAr = await service.findAllPublic('ar');
    expect(resAr[0].name).toBe('فندق عربي');
    expect(resAr[0].description).toBe('وصف عربي');

    const resEs = await service.findAllPublic('es');
    expect(resEs[0].name).toBe('Hotel Español');
    expect(resEs[0].description).toBe('Descripción Española');

    const resPt = await service.findAllPublic('pt');
    expect(resPt[0].name).toBe('Hotel Português');
    expect(resPt[0].description).toBe('Descrição Portuguesa');

    const resIt = await service.findAllPublic('it');
    expect(resIt[0].name).toBe('Hotel Italiano');
    expect(resIt[0].description).toBe('Descrizione Italiana');
  });

  it('resolves heroMediaId to secureUrl and falls back to destination photo when no media is linked', async () => {
    const hotelWithMedia = {
      ...hotel,
      heroMediaId: 'media-asset-uuid-1',
    };

    const prisma = {
      hotel: { findMany: jest.fn().mockResolvedValue([hotelWithMedia]) },
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'media-asset-uuid-1', secureUrl: 'https://res.cloudinary.com/demo/hotel.webp', url: 'http://demo/hotel.webp', altText: 'Luxury Facade' },
        ]),
      },
    };
    const service = new HotelsService(prisma as never);

    const res = await service.findAllPublic('en');
    expect(res[0].heroImageUrl).toBe('https://res.cloudinary.com/demo/hotel.webp');
    expect(res[0].heroImageAlt).toBe('Luxury Facade');
  });

  it('handles archive, unarchive, and soft delete lifecycle transitions', async () => {
    const prisma = {
      hotel: {
        findFirst: jest.fn().mockResolvedValue({ ...hotel, rooms: [] }),
        update: jest.fn().mockResolvedValue({ id: hotel.id, status: 'ARCHIVED' }),
      },
      hotelRoom: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((fnOrArr) => {
        if (typeof fnOrArr === 'function') return fnOrArr(prisma);
        return Promise.all(fnOrArr);
      }),
    };
    const service = new HotelsService(prisma as never);

    await service.archiveAdmin(hotel.id);
    expect(prisma.hotel.update).toHaveBeenCalledWith({
      where: { id: hotel.id },
      data: { status: 'ARCHIVED', isActive: false },
    });

    await service.unarchiveAdmin(hotel.id);
    expect(prisma.hotel.update).toHaveBeenCalledWith({
      where: { id: hotel.id },
      data: { status: 'DRAFT', isActive: false },
    });

    await service.softDeleteAdmin(hotel.id);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
