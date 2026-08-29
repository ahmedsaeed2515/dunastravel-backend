import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function check() {
  const tours = await prisma.tour.findMany({
    where: { deletedAt: null },
    select: { slug: true, country: true, basePriceUsd: true },
    orderBy: { country: 'asc' }
  });

  const byCountry: Record<string, { count: number; min: number; max: number; samples: string[] }> = {};

  for (const t of tours) {
    const c = t.country || 'Unknown';
    const p = Number(t.basePriceUsd);
    if (!byCountry[c]) {
      byCountry[c] = { count: 0, min: p, max: p, samples: [] };
    }
    byCountry[c].count++;
    if (p < byCountry[c].min) byCountry[c].min = p;
    if (p > byCountry[c].max) byCountry[c].max = p;
    if (byCountry[c].samples.length < 3) {
      byCountry[c].samples.push(`${t.slug}: $${p}`);
    }
  }

  console.log('========================================================================');
  console.log('📊 LIVE DATABASE PRICING VERIFICATION BY DESTINATION');
  console.log('========================================================================\n');
  for (const [country, stats] of Object.entries(byCountry)) {
    console.log(`🌍 ${country.padEnd(25, ' ')} -> ${stats.count} tours | Price Range: $${stats.min} - $${stats.max}`);
    console.log(`   Samples: ${stats.samples.join(' | ')}`);
  }
}

check().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
