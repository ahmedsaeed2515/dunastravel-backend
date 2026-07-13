import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying all ADMIN and SUPER_ADMIN users...');
  
  const result = await prisma.user.updateMany({
    where: {
      role: {
        in: ['ADMIN', 'SUPER_ADMIN'],
      },
    },
    data: {
      isVerified: true,
    },
  });

  console.log(`Successfully verified ${result.count} admins.`);
  
  // Just in case they are logging in with a regular USER account that should be admin:
  // Let's print out the users in the database to see what they might be using.
  const users = await prisma.user.findMany({
    select: { email: true, role: true, isVerified: true },
  });
  console.log('Current users:', users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
