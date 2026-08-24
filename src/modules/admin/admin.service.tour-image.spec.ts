import { AdminService } from './admin.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService hero image mutation', () => {
  const prisma = {
    tour: { findUnique: jest.fn() },
    tourImage: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    tourActivityLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const cache = { del: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminService(prisma as any, cache as any, {} as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it('sets one selected image as hero transactionally and records the action', async () => {
    prisma.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
    prisma.tourImage.findFirst.mockResolvedValue({ id: 'image-2' });
    prisma.tourImage.findUniqueOrThrow.mockResolvedValue({ id: 'image-2', isHero: true });

    await expect(service.setTourHeroImage('nile-cruise', 'image-2', 'admin-1')).resolves.toEqual({ id: 'image-2', isHero: true });

    expect(prisma.tourImage.updateMany).toHaveBeenCalledWith({
      where: { tourId: 'tour-1', isHero: true },
      data: { isHero: false },
    });
    expect(prisma.tourImage.update).toHaveBeenCalledWith({
      where: { id: 'image-2' },
      data: { isHero: true },
    });
    expect(prisma.tourActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'TOUR_HERO_IMAGE_UPDATED', userId: 'admin-1' }),
    });
  });

  it('does not clear a tour hero when the requested image is outside the tour', async () => {
    prisma.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
    prisma.tourImage.findFirst.mockResolvedValue(null);

    await expect(service.setTourHeroImage('nile-cruise', 'other-tour-image', 'admin-1')).rejects.toThrow(NotFoundException);
    expect(prisma.tourImage.updateMany).not.toHaveBeenCalled();
  });
});
