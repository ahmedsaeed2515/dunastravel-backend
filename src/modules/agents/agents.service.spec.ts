import { AgentsService } from './agents.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AgentsService', () => {
  it('applies the dashboard search to agent identity fields', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new AgentsService(prisma as unknown as PrismaService);

    await service.findAll({ page: 1, limit: 10, search: 'ahmed' });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: 'AGENT',
        OR: expect.arrayContaining([
          { name: { contains: 'ahmed', mode: 'insensitive' } },
          { email: { contains: 'ahmed', mode: 'insensitive' } },
        ]),
      }),
    });
  });
});
