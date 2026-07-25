import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function getCount(modelName: string): Promise<number | string> {
  try {
    if ((prisma as any)[modelName]) {
      return await (prisma as any)[modelName].count();
    }
    return "Model not generated in Prisma client";
  } catch (err: any) {
    return `Error: ${err.message.split('\n')[0]}`;
  }
}

async function main() {
  const models = [
    'tour', 'destination', 'tourCategory', 'tourItinerary',
    'tourAvailability', 'tourDeparture', 'tourLandingPage', 'cmsBlock',
    'tourImage', 'booking'
  ];

  const results: Record<string, any> = {};
  for (const model of models) {
    results[model] = await getCount(model);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
