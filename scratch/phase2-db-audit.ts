import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService();

async function runDbAudit() {
  console.log('=== PHASE 2 DATABASE INDEX AUDIT ===\n');

  // 1. Fetch indexes on tours, bookings, tailor_made_inquiries, contact_submissions directly from PostgreSQL pg_indexes
  const indexes: any[] = await prisma.$queryRaw`
    SELECT 
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('tours', 'bookings', 'tailor_made_inquiries', 'contact_submissions')
    ORDER BY tablename, indexname;
  `;

  console.log('Actual PostgreSQL Indexes currently deployed in database:');
  console.table(indexes.map(i => ({ table: i.tablename, index: i.indexname, definition: i.indexdef })));

  // 2. Test EXPLAIN (ANALYZE, BUFFERS) for Tour query with status, isActive, deletedAt, category
  console.log('\n=== EXPLAIN ANALYZE: Tour Filter Query ===');
  try {
    const tourExplain: any = await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM "tours"
      WHERE "deleted_at" IS NULL
        AND "status" = 'PUBLISHED'
        AND "is_active" = true
        AND "category" = 'EGYPT'
      LIMIT 20;
    `;
    console.log(JSON.stringify(tourExplain, null, 2));
  } catch (err: any) {
    console.error('Error running Tour EXPLAIN:', err.message);
  }

  // 3. Test EXPLAIN ANALYZE for Booking query with deletedAt, status, createdAt
  console.log('\n=== EXPLAIN ANALYZE: Booking List Query ===');
  try {
    const bookingExplain: any = await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM "bookings"
      WHERE "deleted_at" IS NULL
        AND "status" = 'CONFIRMED'
      ORDER BY "created_at" DESC
      LIMIT 20;
    `;
    console.log(JSON.stringify(bookingExplain, null, 2));
  } catch (err: any) {
    console.error('Error running Booking EXPLAIN:', err.message);
  }

  // 4. Test EXPLAIN ANALYZE for case-insensitive search ILIKE query
  console.log('\n=== EXPLAIN ANALYZE: Case-Insensitive Tour Search Query ===');
  try {
    const ilikeExplain: any = await prisma.$queryRaw`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM "tours"
      WHERE "deleted_at" IS NULL
        AND "title_en" ILIKE '%egypt%'
      LIMIT 20;
    `;
    console.log(JSON.stringify(ilikeExplain, null, 2));
  } catch (err: any) {
    console.error('Error running ILIKE EXPLAIN:', err.message);
  }

  await prisma.$disconnect();
}

runDbAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
