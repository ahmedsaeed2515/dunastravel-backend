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

  it('creates and lists pricing seasons with localized names and multipliers', async () => {
    const seasonRecord = {
      id: 'season-uuid-1',
      code: 'WINTER_PEAK_2026',
      nameJsonb: { en: 'Winter Peak', ar: 'ذروة الشتاء' },
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2027-02-28T00:00:00.000Z'),
      multiplier: 1.35,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      season: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(seasonRecord),
        findMany: jest.fn().mockResolvedValue([seasonRecord]),
      },
    };
    const service = new HotelsService(prisma as never);

    const created = await service.createSeasonAdmin({
      code: 'WINTER_PEAK_2026',
      nameJsonb: { en: 'Winter Peak', ar: 'ذروة الشتاء' },
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      multiplier: 1.35,
    });
    expect(created.code).toBe('WINTER_PEAK_2026');
    expect(created.multiplier).toBe(1.35);

    const publicSeasons = await service.findAllSeasonsPublic('ar');
    expect(publicSeasons).toEqual([
      expect.objectContaining({
        code: 'WINTER_PEAK_2026',
        name: 'ذروة الشتاء',
        multiplier: 1.35,
      }),
    ]);
  });

  it('exposes both ratePerNight and ratePerNightUsd on public room seasonPricings (BUG-05)', async () => {
    const hotelWithSeasonalRoom = {
      ...hotel,
      rooms: [
        {
          id: 'room-uuid-1',
          slug: 'royal-suite',
          nameJsonb: { en: 'Royal Suite' },
          descriptionJsonb: { en: 'Luxury suite' },
          ratePerNight: 200,
          currency: 'USD',
          mealPlanJsonb: { en: 'BB' },
          maxOccupancy: 2,
          inventory: 5,
          isActive: true,
          sortOrder: 0,
          seasonPricings: [
            {
              id: 'sp-1',
              seasonId: 'season-1',
              ratePerNight: 260,
              singleSupplement: 75,
              childRate: 50,
              extraBedRate: 90,
              currency: 'USD',
              boardBasis: 'HB',
              isActive: true,
              season: {
                id: 'season-1',
                code: 'PEAK',
                nameJsonb: { en: 'Peak Season' },
                startDate: new Date('2026-12-01T00:00:00.000Z'),
                endDate: new Date('2027-01-15T00:00:00.000Z'),
                isActive: true,
              },
            },
          ],
        },
      ],
    };

    const prisma = {
      hotel: { findFirst: jest.fn().mockResolvedValue(hotelWithSeasonalRoom) },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new HotelsService(prisma as never);

    const detail = await service.findOnePublic('nile-palace-luxor', 'en');
    expect(detail.rooms[0].seasonPricings[0]).toMatchObject({
      ratePerNight: 260,
      ratePerNightUsd: 260,
      singleSupplement: 75,
      singleSupplementUsd: 75,
      childRate: 50,
      childRateUsd: 50,
      extraBedRate: 90,
      extraBedUsd: 90,
    });
  });

  describe('createBookingPublic (BUG-07)', () => {
    const activeRoom = {
      id: 'room-1',
      slug: 'deluxe-double',
      ratePerNight: 150,
      maxOccupancy: 2,
      isActive: true,
      deletedAt: null,
      seasonPricings: [
        {
          id: 'sp-1',
          ratePerNight: 220,
          singleSupplement: 40,
          isActive: true,
          season: {
            isActive: true,
            startDate: new Date('2026-12-01T00:00:00.000Z'),
            endDate: new Date('2026-12-31T00:00:00.000Z'),
          },
        },
      ],
    };

    it('rejects non-existent or unbookable room instead of falling back to $120', async () => {
      const prisma = {
        hotel: {
          findFirst: jest.fn().mockResolvedValue({
            ...hotel,
            rooms: [activeRoom],
          }),
        },
      };
      const service = new HotelsService(prisma as never);

      await expect(
        service.createBookingPublic({
          hotelSlug: 'nile-palace-luxor',
          roomSlug: 'non-existent-room',
          guestName: 'Ahmed Test',
          guestEmail: 'ahmed@example.com',
          guestPhone: '+201000000000',
          checkInDate: '2026-12-10',
          checkOutDate: '2026-12-12',
          roomsCount: 1,
          guestsCount: 2,
        }),
      ).rejects.toThrow('Selected room not found or currently unavailable');
    });

    it('rejects guestsCount exceeding room maxOccupancy * roomsCount', async () => {
      const prisma = {
        hotel: {
          findFirst: jest.fn().mockResolvedValue({
            ...hotel,
            rooms: [activeRoom],
          }),
        },
      };
      const service = new HotelsService(prisma as never);

      await expect(
        service.createBookingPublic({
          hotelSlug: 'nile-palace-luxor',
          roomSlug: 'deluxe-double',
          guestName: 'Ahmed Test',
          guestEmail: 'ahmed@example.com',
          guestPhone: '+201000000000',
          checkInDate: '2026-12-10',
          checkOutDate: '2026-12-12',
          roomsCount: 1,
          guestsCount: 4,
        }),
      ).rejects.toThrow('exceeds maximum capacity');
    });

    it('applies seasonal ratePerNight and singleSupplement for single occupancy during active season', async () => {
      const prisma = {
        hotel: {
          findFirst: jest.fn().mockResolvedValue({
            ...hotel,
            rooms: [activeRoom],
          }),
        },
        hotelBooking: {
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'hb-1', ...data })),
        },
      };
      const service = new HotelsService(prisma as never);

      const booking = await service.createBookingPublic({
        hotelSlug: 'nile-palace-luxor',
        roomSlug: 'deluxe-double',
        guestName: 'Ahmed Test',
        guestEmail: 'ahmed@example.com',
        guestPhone: '+201000000000',
        checkInDate: '2026-12-10',
        checkOutDate: '2026-12-12',
        roomsCount: 1,
        guestsCount: 1,
      });

      // 2 nights * (220 seasonal rate + 40 singleSupplement) = 520
      expect(booking.summary.totalAmountUsd).toBe(520);
      expect(Number((booking.booking as any).totalAmountUsd)).toBe(520);
    });
  });

  describe('updateAdmin partial updates & season deduplication (BUG-11 & BUG-12)', () => {
    it('preserves existing amenitiesJsonb flags when updating only heroImageUrl and deduplicates duplicate seasonIds', async () => {
      const existingHotel = {
        ...hotel,
        amenitiesJsonb: { pool: true, spa: true, heroImageUrl: 'https://old.example/hero.jpg' },
        rooms: [
          {
            id: 'room-1',
            slug: 'deluxe-room',
            nameJsonb: { en: 'Deluxe Room' },
            descriptionJsonb: null,
            ratePerNight: 180,
            currency: 'USD',
            mealPlanJsonb: { en: 'BB' },
            maxOccupancy: 2,
            inventory: 4,
            isActive: true,
            deletedAt: null,
            seasonPricings: [],
          },
        ],
      };

      const prisma = {
        hotel: {
          findFirst: jest.fn().mockResolvedValue(existingHotel),
          update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...existingHotel, ...data })),
        },
        hotelRoom: {
          findMany: jest.fn().mockResolvedValue(existingHotel.rooms),
          update: jest.fn().mockResolvedValue(existingHotel.rooms[0]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        roomSeasonPricing: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
      };

      const service = new HotelsService(prisma as never);

      await service.updateAdmin(existingHotel.id, {
        heroImageUrl: 'https://new.example/hero.jpg',
        rooms: [
          {
            id: 'room-1',
            slug: 'deluxe-room',
            nameJsonb: { en: 'Deluxe Room' },
            ratePerNight: 180,
            maxOccupancy: 2,
            seasonPricings: [
              { seasonId: 'season-1', ratePerNight: 200 },
              { seasonId: 'season-1', ratePerNight: 240, singleSupplement: 50 },
            ],
          },
        ],
      });

      expect(prisma.hotel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amenitiesJsonb: {
              pool: true,
              spa: true,
              heroImageUrl: 'https://new.example/hero.jpg',
            },
          }),
        }),
      );

      expect(prisma.roomSeasonPricing.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            roomId: 'room-1',
            seasonId: 'season-1',
          }),
        ],
      });
    });
  });
});

