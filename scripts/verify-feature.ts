import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

const mockCache = {
  get: async () => null,
  set: async () => {},
};

async function check() {
  const service = new DashboardService(prisma, mockCache as any);

  console.log('========================================================================');
  console.log('📊 LIVE BACKEND DASHBOARD VERIFICATION (2026)');
  console.log('========================================================================\n');

  console.log('1. Executive Summary (2026):');
  const summary = await service.getExecutiveSummary({ preset: '2026' });
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n2. Revenue Trend (2026):');
  const revenueTrend = await service.getRevenueTrend({ preset: '2026' });
  console.log(JSON.stringify(revenueTrend, null, 2));

  console.log('\n3. Top Destinations (2026):');
  const topDestinations = await service.getTopDestinations({ preset: '2026' });
  console.log(JSON.stringify(topDestinations, null, 2));

  console.log('\n4. Tour Performance Rankings (2026):');
  const tourPerformance = await service.getTourPerformance({ preset: '2026' });
  console.log('Most Booked Top 4:');
  tourPerformance.rankings.mostBooked.slice(0, 4).forEach((t) => {
    console.log(`- ${t.slug} | Price: $${t.displayPriceUsd || t.basePriceUsd} | Bookings: ${t.confirmedBookings} | Occupancy: ${t.occupancyRate}%`);
  });
}

check().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
