const { JwtService } = require('@nestjs/jwt');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, role: true, sessionVersion: true }
    });

    const regularUser = await prisma.user.findFirst({
      where: { role: 'USER' },
      select: { id: true, email: true, role: true, sessionVersion: true }
    });

    console.log('Found admin:', adminUser?.email, 'Found user:', regularUser?.email);

    const secret = process.env.JWT_SECRET;
    const jwtService = new JwtService({ secret });

    const adminToken = adminUser ? jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      sv: adminUser.sessionVersion,
    }, {
      expiresIn: '7d',
      issuer: process.env.JWT_ISSUER || 'dunas-travel-api',
      audience: process.env.JWT_AUDIENCE || 'dunas-travel-clients',
    }) : null;

    const customerToken = regularUser ? jwtService.sign({
      sub: regularUser.id,
      email: regularUser.email,
      role: regularUser.role,
      sv: regularUser.sessionVersion,
    }, {
      expiresIn: '7d',
      issuer: process.env.JWT_ISSUER || 'dunas-travel-api',
      audience: process.env.JWT_AUDIENCE || 'dunas-travel-clients',
    }) : null;

    const tokens = { customerToken, adminToken };
    const targetPath = path.resolve('../tests/performance/k6/data/tokens.json');
    fs.writeFileSync(targetPath, JSON.stringify(tokens, null, 2));

    console.log('Successfully wrote real signed tokens to:', targetPath);
  } catch (err) {
    console.error('Error generating tokens:', err.message);
  } finally {
    await prisma['$disconnect']();
    await pool.end();
  }
}

run();
