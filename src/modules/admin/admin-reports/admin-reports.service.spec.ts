import { AdminReportsService } from './admin-reports.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminReportsService destinations report', () => {
  it('aggregates real tours, counts tours and ignores blank destinations', async () => {
    const prisma = {
      tour: {
        findMany: jest.fn().mockResolvedValue([
          { city: 'Cairo', country: 'Egypt', _count: { bookings: 3 } },
          { city: 'Cairo', country: 'Egypt', _count: { bookings: 2 } },
          { city: null, country: 'Turkey', _count: { bookings: 1 } },
          { city: '  ', country: null, _count: { bookings: 9 } },
        ]),
      },
    } as unknown as PrismaService;

    const service = new AdminReportsService(prisma);

    await expect(service.getDestinationsReport()).resolves.toEqual([
      {
        location: 'Cairo, Egypt',
        country: 'Egypt',
        city: 'Cairo',
        bookingCount: 5,
        tourCount: 2,
      },
      {
        location: 'Turkey',
        country: 'Turkey',
        city: null,
        bookingCount: 1,
        tourCount: 1,
      },
    ]);
  });
});
