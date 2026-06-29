import { PrismaClient, MediaEntityType, MediaProvenance } from '@prisma/client';

export async function seedMediaAssets(prisma: PrismaClient): Promise<void> {
  console.log('\n📌 Seeding media assets from existing TourImage records...');

  const tourImages = await prisma.tourImage.findMany();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < tourImages.length; i++) {
    const ti = tourImages[i];
    // Deterministic publicId
    const publicId = `seeded/${ti.tourId}/${i}`;

    try {
      const existing = await prisma.mediaAsset.findUnique({
        where: { publicId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.mediaAsset.create({
        data: {
          publicId,
          url: ti.imageUrl,
          secureUrl: ti.imageUrl,
          providerName: 'seeded',
          format: 'jpg',
          mimeType: 'image/jpeg',
          bytes: 0,
          width: null,
          height: null,
          entityType: MediaEntityType.TOUR,
          entityId: ti.tourId,
          provenance: MediaProvenance.SEEDED,
          altText: ti.altText,
          uploadedBy: null,
        },
      });
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to seed media asset for TourImage ${ti.id}`, error);
      failed++;
    }
  }

  console.log(`  ✅ Seeded ${created} media assets (${skipped} skipped, ${failed} failed).`);
}
