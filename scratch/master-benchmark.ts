process.env.NODE_ENV = 'test';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';

export interface EndpointMetric {
  endpoint: string;
  method: string;
  category: string;
  auth: 'none' | 'user' | 'admin';
  statusCode: number;
  durationMs: number;
  queryCount: number;
  queryTimeMs: number;
  responseSizeBytes: number;
  queries: string[];
}

async function runBenchmark() {
  console.log('🚀 Starting Master Benchmark Audit Server on port 5003...');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(5003);
  console.log('✅ Server listening on port 5003');

  const prisma = app.get(PrismaService);

  let currentQueries: { query: string; duration: number }[] = [];
  (prisma as any).$on('query', (e: any) => {
    currentQueries.push({ query: e.query, duration: e.duration });
  });

  // Ensure Admin & User
  const adminEmail = 'admin_audit@example.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin Audit',
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
        isVerified: true,
      },
    });
  }

  const userEmail = 'user_audit@example.com';
  let normalUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!normalUser) {
    normalUser = await prisma.user.create({
      data: {
        name: 'User Audit',
        email: userEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'USER',
        isVerified: true,
      },
    });
  }

  const client = axios.create({
    baseURL: 'http://127.0.0.1:5003/api',
    validateStatus: () => true,
    timeout: 10000,
  });

  console.log('🔑 Authenticating test clients...');
  let res = await client.post('/auth/login', { email: adminEmail, password: 'password123' });
  const adminCookieRaw = res.headers['set-cookie']?.[0] || '';
  const adminCookie = adminCookieRaw.split(';')[0];

  res = await client.post('/auth/login', { email: userEmail, password: 'password123' });
  const userCookieRaw = res.headers['set-cookie']?.[0] || '';
  const userCookie = userCookieRaw.split(';')[0];

  const adminHeaders = { Cookie: adminCookie };
  const userHeaders = { Cookie: userCookie };

  const sampleTour = await prisma.tour.findFirst();
  const sampleBooking = await prisma.booking.findFirst();
  const sampleInquiry = await prisma.tailorMadeInquiry.findFirst();
  const sampleDestination = await prisma.tour.findFirst({ select: { country: true, city: true } });

  const endpointsToTest: Array<{
    category: string;
    method: 'GET' | 'POST';
    url: string;
    headers?: any;
    auth: 'none' | 'user' | 'admin';
    body?: any;
  }> = [
    { category: 'Health', method: 'GET', url: '/health/liveness', auth: 'none' },
    { category: 'Tours', method: 'GET', url: '/tours', auth: 'none' },
    { category: 'Tours', method: 'GET', url: '/tours?category=LUXURY&country=Egypt', auth: 'none' },
    { category: 'Tours', method: 'GET', url: sampleTour ? `/tours/${sampleTour.slug}` : '/tours/non-existent', auth: 'none' },
    { category: 'Tours', method: 'GET', url: sampleTour ? `/tours/${sampleTour.slug}/reviews` : '/tours/test/reviews', auth: 'none' },
    { category: 'Destinations', method: 'GET', url: '/destinations', auth: 'none' },
    { category: 'Reviews', method: 'GET', url: '/reviews/featured', auth: 'none' },
    { category: 'CMS', method: 'GET', url: '/cms/pages/home', auth: 'none' },
    { category: 'CMS', method: 'GET', url: '/cms/site-settings', auth: 'none' },
    { category: 'Currency', method: 'GET', url: '/currency/rates', auth: 'none' },

    { category: 'Auth', method: 'GET', url: '/auth/me', headers: userHeaders, auth: 'user' },
    { category: 'Users', method: 'GET', url: '/users/profile', headers: userHeaders, auth: 'user' },

    { category: 'Admin Dashboard', method: 'GET', url: '/admin/dashboard', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Bookings', method: 'GET', url: '/admin/bookings', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Bookings', method: 'GET', url: sampleBooking ? `/admin/bookings/${sampleBooking.referenceCode}` : '/admin/bookings/TEST', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Tours', method: 'GET', url: '/admin/tours', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Inquiries', method: 'GET', url: '/admin/inquiries', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Contact', method: 'GET', url: '/admin/contact-submissions', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Reviews', method: 'GET', url: '/admin/reviews', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin CMS', method: 'GET', url: '/admin/cms', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Reports', method: 'GET', url: '/admin/reports/bookings-trend', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Reports', method: 'GET', url: '/admin/reports/revenue', headers: adminHeaders, auth: 'admin' },
    { category: 'Admin Reports', method: 'GET', url: '/admin/reports/destinations', headers: adminHeaders, auth: 'admin' },
  ];

  const results: EndpointMetric[] = [];
  console.log(`\n📊 Benchmarking ${endpointsToTest.length} key endpoints...\n`);

  for (const item of endpointsToTest) {
    currentQueries = [];
    const startTime = Date.now();
    let res;
    try {
      if (item.method === 'GET') {
        res = await client.get(item.url, { headers: item.headers });
      } else {
        res = await client.post(item.url, item.body, { headers: item.headers });
      }
    } catch (err: any) {
      console.error(`❌ Request failed: ${item.method} ${item.url}`, err.message);
      continue;
    }
    const durationMs = Date.now() - startTime;
    const queryCount = currentQueries.length;
    const queryTimeMs = currentQueries.reduce((acc, q) => acc + (q.duration || 0), 0);
    const responseSizeBytes = JSON.stringify(res.data || '').length;

    const metric: EndpointMetric = {
      endpoint: item.url,
      method: item.method,
      category: item.category,
      auth: item.auth,
      statusCode: res.status,
      durationMs,
      queryCount,
      queryTimeMs,
      responseSizeBytes,
      queries: currentQueries.map((q) => q.query),
    };

    results.push(metric);

    console.log(
      `[${item.method}] ${item.url.padEnd(42)} | Status: ${res.status} | Time: ${durationMs.toString().padStart(4)}ms | DB Qs: ${queryCount.toString().padStart(2)} (${queryTimeMs.toFixed(1)}ms) | Size: ${(responseSizeBytes / 1024).toFixed(1)}KB`
    );

    // Save partial results after each endpoint
    fs.writeFileSync('scratch/baseline_benchmark.json', JSON.stringify(results, null, 2));
  }

  console.log('\n✅ Baseline benchmark completed successfully. Output saved to scratch/baseline_benchmark.json');

  await app.close();
  process.exit(0);
}

runBenchmark().catch((e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
