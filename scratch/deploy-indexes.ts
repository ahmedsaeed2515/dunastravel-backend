import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService();

async function deployIndexes() {
  console.log('Deploying composite database indexes to PostgreSQL...');

  const statements = [
    `CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_category_idx" ON "tours"("status", "is_active", "deleted_at", "category");`,
    `CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_country_idx" ON "tours"("status", "is_active", "deleted_at", "country");`,
    `CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_city_idx" ON "tours"("status", "is_active", "deleted_at", "city");`,
    `CREATE INDEX IF NOT EXISTS "tours_status_is_active_deleted_at_is_featured_idx" ON "tours"("status", "is_active", "deleted_at", "is_featured");`,
    `CREATE INDEX IF NOT EXISTS "bookings_deleted_at_status_created_at_idx" ON "bookings"("deleted_at", "status", "created_at");`,
    `CREATE INDEX IF NOT EXISTS "bookings_deleted_at_tour_id_created_at_idx" ON "bookings"("deleted_at", "tour_id", "created_at");`,
  ];

  for (const sql of statements) {
    console.log(`Executing: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('✅ All composite indexes successfully deployed to PostgreSQL.');
  await prisma.$disconnect();
}

deployIndexes().catch(err => {
  console.error('Failed to deploy indexes:', err);
  process.exit(1);
});
