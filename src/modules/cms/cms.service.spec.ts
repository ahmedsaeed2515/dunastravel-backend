import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CmsService } from './cms.service';

describe('CmsService managed catalogs', () => {
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const tx = {
    cmsBlock: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const service = new CmsService(prisma as never, cache as never);
  const actor = { id: 'admin-1', role: 'ADMIN' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.cmsBlock.findUnique.mockResolvedValue({
      key: 'hotels_catalog',
      content: [],
    });
    tx.cmsBlock.upsert.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});
  });

  it('appends a server-identified catalog item atomically', async () => {
    const result = await service.createCatalogItem(
      'hotels_catalog',
      { name: 'Dunas Hotel' },
      actor,
    );

    expect(result).toMatchObject({ name: 'Dunas Hotel' });
    expect(result?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(tx.cmsBlock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          content: [expect.objectContaining({ name: 'Dunas Hotel' })],
          lastUpdatedBy: 'admin-1',
        },
      }),
    );
    expect(cache.del).toHaveBeenCalledWith('cms:hotels_catalog');
  });

  it('rejects mutation of non-catalog CMS blocks', async () => {
    await expect(
      service.createCatalogItem('homepage.hero', { title: 'Nope' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects updates for missing catalog items', async () => {
    await expect(
      service.updateCatalogItem(
        'hotels_catalog',
        '11111111-1111-4111-8111-111111111111',
        { name: 'Missing' },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
