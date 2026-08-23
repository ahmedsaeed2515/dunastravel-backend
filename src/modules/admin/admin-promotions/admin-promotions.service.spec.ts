import { AdminPromotionsService } from './admin-promotions.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminPromotionsService', () => {
  it('returns a server-paginated, searchable promotion list', async () => {
    const prisma = {
      promotion: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'promotion-1', code: 'SUMMER' }]),
        count: jest.fn().mockResolvedValue(11),
      },
    };
    const service = new AdminPromotionsService(
      prisma as unknown as PrismaService,
    );

    const result = await service.listPromotions({
      page: 2,
      limit: 5,
      search: 'sum',
    });

    const where = { code: { contains: 'sum', mode: 'insensitive' } };
    expect(prisma.promotion.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.promotion.count).toHaveBeenCalledWith({ where });
    expect(result.meta).toEqual({
      total: 11,
      page: 2,
      limit: 5,
      totalPages: 3,
    });
  });
});
