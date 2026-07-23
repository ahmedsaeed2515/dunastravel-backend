import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/dunastravel_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function promoteUser() {
  const email = 'test_user_unique_123@example.com';
  console.log(`Promoting user: ${email}`);

  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log('User promoted successfully:', user.email, user.role, user.isVerified);
  } catch (error) {
    console.error('Failed to promote user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

promoteUser();
