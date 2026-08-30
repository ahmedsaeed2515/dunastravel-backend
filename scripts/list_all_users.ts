import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const allUsers = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      customerNumber: true,
      createdAt: true,
    }
  });

  console.log(`TOTAL ACTIVE USERS: ${allUsers.length}`);
  console.table(allUsers.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    customerNumber: u.customerNumber || '—',
    created: u.createdAt.toISOString().slice(0, 10),
  })));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
