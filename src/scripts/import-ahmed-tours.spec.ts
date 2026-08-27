import { canonicalImageUrl, syncTourImages } from '../../scripts/import-ahmed-tours';

describe('Ahmed tour image import', () => {
  it('canonicalizes tracking-only URL variants', () => {
    expect(
      canonicalImageUrl('https://images.example.test/tour.jpg?utm_source=source&width=1200#hero'),
    ).toBe('https://images.example.test/tour.jpg?width=1200');
  });

  it('preserves existing Cloudinary rows and only appends new canonical source URLs once', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        imageUrl: 'https://res.cloudinary.com/dunas/image/upload/v1/catalog/tour.webp',
        isHero: true,
        sortOrder: 4,
      },
      {
        imageUrl: 'https://images.example.test/known.jpg?width=1200',
        isHero: false,
        sortOrder: 5,
      },
    ]);
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const deleteMany = jest.fn();
    const prisma = {
      tourImage: { findMany, createMany, deleteMany },
    } as any;

    await syncTourImages(prisma, 'tour-1', [
      { imageUrl: 'https://images.example.test/known.jpg?width=1200&utm_source=import', isHero: true, altText: null, sortOrder: 0 },
      { imageUrl: 'https://images.example.test/new.jpg', isHero: false, altText: null, sortOrder: 1 },
      { imageUrl: 'https://images.example.test/new.jpg', isHero: false, altText: null, sortOrder: 2 },
    ]);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          tourId: 'tour-1',
          imageUrl: 'https://images.example.test/new.jpg',
          altText: null,
          isHero: false,
          sortOrder: 6,
        },
      ],
    });
  });
});
