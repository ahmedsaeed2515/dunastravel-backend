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
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isVerified: true,
      customerNumber: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });
  console.log('=== 30 MOST RECENT USERS IN DB ===');
  console.table(
    users.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      isVerified: u.isVerified,
      customerNumber: u.customerNumber,
      created: u.createdAt.toISOString().slice(0, 19),
      deletedAt: u.deletedAt,
    }))
  );

  const roles = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true },
  });
  console.log('=== USERS BY ROLE ===', roles);

  const statuses = await prisma.user.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('=== USERS BY STATUS ===', statuses);

  const recentAudits = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      action: true,
      actorId: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      metadata: true,
    },
  });
  console.log('=== RECENT 10 AUDIT LOGS ===', recentAudits);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
