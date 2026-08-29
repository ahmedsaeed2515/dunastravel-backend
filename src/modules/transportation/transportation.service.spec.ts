import { TransportationService } from './transportation.service';
import { Prisma } from '@prisma/client';

describe('TransportationService', () => {
  const mockService = {
    id: 'tr-bus-50-luxury',
    name: 'Super Luxury Coach 50 Seats',
    serviceType: 'BUS',
    vehicleCategory: 'bus',
    vehicleType: 'Mercedes-Benz Travego VIP',
    capacity: 50,
    doors: 2,
    transmission: 'AUTO',
    basePriceUsd: new Prisma.Decimal(350),
    heroImageUrl: '/imgs/transportation/bus1.jpeg',
    heroMediaId: null,
    isPrivate: false,
    isActive: true,
    featuresJsonb: ['Air Conditioning', 'WiFi'],
    description: 'Executive bus',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns active transportation services with formatted fields', async () => {
    const prisma = {
      transportationService: {
        findMany: jest.fn().mockResolvedValue([mockService]),
        upsert: jest.fn(),
      },
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new TransportationService(prisma as never);

    const result = await service.findAllServices();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'tr-bus-50-luxury',
        name: 'Super Luxury Coach 50 Seats',
        basePriceUsd: 350,
        features: ['Air Conditioning', 'WiFi'],
      }),
    );
  });

  it('creates booking safely for guest visitors (null userId)', async () => {
    const createdBooking = {
      id: 'tb-123',
      referenceCode: 'TR-ABC123XYZ',
      serviceId: mockService.id,
      userId: null,
      pickupDate: new Date('2026-09-01'),
      pickupTime: '10:00',
      pickupLocation: 'Cairo Airport Terminal 3',
      dropoffLocation: 'Four Seasons Cairo',
      passengerCount: 2,
      luggageCount: 2,
      flightNumber: 'MS777',
      notes: 'VIP guest',
      totalAmountUsd: new Prisma.Decimal(420),
      status: 'SUBMITTED',
      idempotencyKey: 'idemp-test-123',
      requestHash: 'hash-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prisma = {
      transportationBooking: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdBooking),
      },
      transportationService: {
        findUnique: jest.fn().mockResolvedValue(mockService),
      },
    };
    const service = new TransportationService(prisma as never);

    const booking = await service.createBooking(
      null,
      {
        serviceId: mockService.id,
        pickupDate: '2026-09-01',
        pickupTime: '10:00',
        pickupLocation: 'Cairo Airport Terminal 3',
        dropoffLocation: 'Four Seasons Cairo',
        passengerCount: 2,
        luggageCount: 2,
        flightNumber: 'MS777',
        notes: 'VIP guest',
      },
      'idemp-test-123',
    );

    expect(booking).toEqual(
      expect.objectContaining({
        referenceCode: 'TR-ABC123XYZ',
        serviceId: mockService.id,
        userId: null,
        status: 'SUBMITTED',
      }),
    );
    expect(prisma.transportationBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          pickupLocation: 'Cairo Airport Terminal 3',
          dropoffLocation: 'Four Seasons Cairo',
        }),
      }),
    );
  });
});
