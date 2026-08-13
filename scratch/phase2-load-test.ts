import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

interface BenchmarkResult {
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  rps: number;
  avgLatencyMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxLatencyMs: number;
  errorRatePercent: number;
  payloadSizeBytes: number;
}

async function runBenchmark(
  client: any,
  endpoint: string,
  headers: any,
  concurrency: number,
  durationSeconds: number = 3
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errorCount = 0;
  let successCount = 0;
  let payloadSizeBytes = 0;

  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;

  const worker = async () => {
    while (Date.now() < endTime) {
      const reqStart = performance.now();
      try {
        const res = await client.get(endpoint, { headers });
        const reqEnd = performance.now();
        if (res.status >= 200 && res.status < 400) {
          latencies.push(reqEnd - reqStart);
          successCount++;
          if (payloadSizeBytes === 0 && res.data) {
            payloadSizeBytes = Buffer.byteLength(JSON.stringify(res.data));
          }
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }
  };

  const workers = Array(concurrency).fill(null).map(() => worker());
  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const totalRequests = successCount + errorCount;
  const rps = totalRequests > 0 ? (totalRequests / (totalTimeMs / 1000)) : 0;

  latencies.sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    if (latencies.length === 0) return 0;
    const idx = Math.floor((p / 100) * latencies.length);
    return latencies[Math.min(idx, latencies.length - 1)];
  };

  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  return {
    endpoint,
    concurrency,
    totalRequests,
    rps: Number(rps.toFixed(1)),
    avgLatencyMs: Number(avgLatencyMs.toFixed(1)),
    p50Ms: Number(getPercentile(50).toFixed(1)),
    p90Ms: Number(getPercentile(90).toFixed(1)),
    p95Ms: Number(getPercentile(95).toFixed(1)),
    p99Ms: Number(getPercentile(99).toFixed(1)),
    maxLatencyMs: Number(getPercentile(100).toFixed(1)),
    errorRatePercent: totalRequests > 0 ? Number(((errorCount / totalRequests) * 100).toFixed(1)) : 0,
    payloadSizeBytes,
  };
}

async function startLoadTest() {
  console.log('=== PHASE 2 REAL CONCURRENCY LOAD BENCHMARK ===\n');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  await app.listen(5015);

  const prisma = app.get(PrismaService);
  const adminEmail = 'admin_loadtest@example.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin LoadTest',
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
        isVerified: true,
      },
    });
  }

  const client = axios.create({
    baseURL: 'http://localhost:5015/api',
    validateStatus: () => true,
  });

  const loginRes = await client.post('/auth/login', { email: adminEmail, password: 'password123' });
  const adminSetCookies = loginRes.headers['set-cookie'] || [];
  const adminCookie = adminSetCookies.map((c: string) => c.split(';')[0]).join('; ');
  const csrfToken = loginRes.data?.csrfToken || '';
  const authHeaders = {
    Cookie: adminCookie,
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
  };

  const endpointsToTest = [
    { name: 'GET /api/health/liveness', url: '/health/liveness', public: true },
    { name: 'GET /api/tours', url: '/tours', public: true },
    { name: 'GET /api/destinations', url: '/destinations', public: true },
    { name: 'GET /api/admin/dashboard', url: '/admin/dashboard', public: false },
    { name: 'GET /api/admin/bookings', url: '/admin/bookings', public: false },
  ];

  const concurrencies = [1, 5, 10, 25, 50];
  const allResults: BenchmarkResult[] = [];

  for (const ep of endpointsToTest) {
    console.log(`\nTesting Endpoint: ${ep.name}`);
    const headers = ep.public ? {} : authHeaders;

    for (const c of concurrencies) {
      process.stdout.write(`  Concurrency ${c}... `);
      const res = await runBenchmark(client, ep.name, headers, c, 2);
      allResults.push(res);
      console.log(`RPS: ${res.rps} | Avg: ${res.avgLatencyMs}ms | p95: ${res.p95Ms}ms | p99: ${res.p99Ms}ms | Errors: ${res.errorRatePercent}% | Size: ${res.payloadSizeBytes}B`);
    }
  }

  // Cold vs Warm Cache Benchmark for Dashboard
  console.log('\n--- Cold vs Warm Cache Test: GET /api/admin/dashboard ---');
  // Cold Cache
  const coldStart = performance.now();
  await client.get('/admin/dashboard', { headers: authHeaders });
  const coldMs = performance.now() - coldStart;

  // Warm Cache
  const warmStart = performance.now();
  await client.get('/admin/dashboard', { headers: authHeaders });
  const warmMs = performance.now() - warmStart;

  console.log(`Cold Cache Latency: ${coldMs.toFixed(1)}ms`);
  console.log(`Warm Cache Latency: ${warmMs.toFixed(1)}ms`);

  // Failure Performance Test (401 & 404)
  console.log('\n--- Failure Endpoint Latency Test ---');
  const unauthStart = performance.now();
  await client.get('/admin/bookings'); // No auth header
  const unauthMs = performance.now() - unauthStart;

  const notFoundStart = performance.now();
  await client.get('/admin/bookings/INVALID_REF_123', { headers: authHeaders });
  const notFoundMs = performance.now() - notFoundStart;

  console.log(`401 Unauthorized Latency: ${unauthMs.toFixed(1)}ms`);
  console.log(`404 Not Found Latency: ${notFoundMs.toFixed(1)}ms`);

  await app.close();
  console.log('\n=== LOAD BENCHMARK COMPLETE ===');
  process.exit(0);
}

startLoadTest().catch(err => {
  console.error('Load Test Error:', err);
  process.exit(1);
});
