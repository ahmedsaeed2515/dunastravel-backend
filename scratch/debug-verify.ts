import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function debugStep() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  await app.listen(5012);

  const prisma = app.get(PrismaService);
  const adminEmail = 'admin_verify@example.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin Verify',
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
        isVerified: true,
      },
    });
  }

  const client = axios.create({
    baseURL: 'http://localhost:5012/api',
    validateStatus: () => true,
  });

  const resLogin = await client.post('/auth/login', { email: adminEmail, password: 'password123' });
  const adminCookieRaw = resLogin.headers['set-cookie']?.[0] || '';
  const adminCookie = adminCookieRaw.split(';')[0];
  const authHeaders = { Cookie: adminCookie };

  const res = await client.get('/admin/bookings?page=1&limit=2', { headers: authHeaders });
  console.log('Response Status:', res.status);
  console.log('Response Payload:', JSON.stringify(res.data, null, 2));

  await app.close();
  process.exit(0);
}

debugStep().catch(console.error);
