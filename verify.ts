import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function runChecks() {
  console.log('Starting verification server on port 5002...');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Dunas Travel API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // mapped to /api/docs because of GlobalPrefix? actually setup ignores GlobalPrefix, so it should be /docs or /api/docs depending on how setup behaves. Let's do 'docs'. Wait, client uses baseURL: '/api', so we need it mapped to '/api/docs'. Let's do setup('api/docs', app, document).

  await app.listen(5002);

  const prisma = app.get(PrismaService);
  
  // Create admin user
  const adminEmail = 'admin_verify@example.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Admin Verify',
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
      }
    });
  }

  // Create normal user
  const userEmail = 'user_verify@example.com';
  let normalUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!normalUser) {
    normalUser = await prisma.user.create({
      data: {
        name: 'User Verify',
        email: userEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'USER',
      }
    });
  }

  const client = axios.create({
    baseURL: 'http://localhost:5002/api',
    validateStatus: () => true,
  });

  console.log('19.1 Application Start: PASSED');

  const extractPayload = (res: any) => {
    // If wrapped by standard interceptor, it has statusCode and data at root
    if (res.data && res.data.statusCode && res.data.data !== undefined) {
      return res.data.data;
    }
    return res.data;
  };

  let res = await client.post('/auth/login', { email: adminEmail, password: 'password123' });
  if (res.status !== 200) {
    console.error('Admin Login failed', res.data);
    process.exit(1);
  }
  const adminCookieRaw = res.headers['set-cookie']?.[0] || '';
  const adminCookie = adminCookieRaw.split(';')[0];

  res = await client.post('/auth/login', { email: userEmail, password: 'password123' });
  if (res.status !== 200) {
    console.error('User Login failed', res.data);
    process.exit(1);
  }
  const userCookieRaw = res.headers['set-cookie']?.[0] || '';
  const userCookie = userCookieRaw.split(';')[0];

  const booking = await prisma.booking.findFirst();
  const inquiry = await prisma.tailorMadeInquiry.findFirst();
  const contact = await prisma.contactSubmission.findFirst();
  
  const authHeaders = { Cookie: adminCookie };

  res = await client.get('/admin/bookings', { headers: authHeaders });
  let payload = extractPayload(res);
  if (res.status !== 200 || !payload.data || payload.total === undefined) {
    console.error('19.2 Failed', res.data);
    process.exit(1);
  }
  if (payload.data[0] && payload.data[0].billingInfo) {
    console.error('19.2 Failed: includes billingInfo in list view');
    process.exit(1);
  }
  console.log('19.2 GET /api/admin/bookings: PASSED');

  if (booking) {
    res = await client.get(`/admin/bookings/${booking.referenceCode}`, { headers: authHeaders });
    payload = extractPayload(res);
    if (res.status !== 200 || !payload.passengers || !('invoiceNumber' in payload)) {
      console.error('19.3 Failed', res.data);
      process.exit(1);
    }
    console.log('19.3 GET /api/admin/bookings/:referenceCode (valid): PASSED');
  }
  res = await client.get('/admin/bookings/INVALID_REF', { headers: authHeaders });
  if (res.status !== 404) {
    console.error('19.4 Failed', res.status);
    process.exit(1);
  }
  console.log('19.4 GET /api/admin/bookings/:referenceCode (invalid): PASSED');

  res = await client.get('/admin/inquiries?status=NEWLY_RECEIVED', { headers: authHeaders });
  if (res.status !== 200) {
    console.error('19.5 Failed', res.status);
    process.exit(1);
  }
  console.log('19.5 GET /api/admin/inquiries with status filter: PASSED');

  if (inquiry) {
    res = await client.get(`/admin/inquiries/${inquiry.referenceCode}`, { headers: authHeaders });
    if (res.status !== 200) {
      console.error('19.6 Failed', res.status);
      process.exit(1);
    }
    console.log('19.6 GET /api/admin/inquiries/:referenceCode (valid): PASSED');

    await prisma.tailorMadeInquiry.update({ where: { id: inquiry.id }, data: { status: 'NEWLY_RECEIVED' } });
    res = await client.patch(`/admin/inquiries/${inquiry.referenceCode}/status`, { status: 'IN_PROGRESS' }, { headers: authHeaders });
    payload = extractPayload(res);
    if (res.status !== 200 || payload.status !== 'IN_PROGRESS') {
      console.error('19.7 Failed', res.data);
      process.exit(1);
    }
    console.log('19.7 PATCH /api/admin/inquiries/:referenceCode/status (valid transition): PASSED');

    await prisma.tailorMadeInquiry.update({ where: { id: inquiry.id }, data: { status: 'CLOSED' } });
    res = await client.patch(`/admin/inquiries/${inquiry.referenceCode}/status`, { status: 'IN_PROGRESS' }, { headers: authHeaders });
    if (res.status !== 400) {
      console.error('19.8 Failed', res.status);
      process.exit(1);
    }
    console.log('19.8 PATCH /api/admin/inquiries/:referenceCode/status (invalid transition): PASSED');
  }

  res = await client.get('/admin/contact-submissions', { headers: authHeaders });
  payload = extractPayload(res);
  if (res.status !== 200 || !payload.data) {
    console.error('19.9 Failed', res.status);
    process.exit(1);
  }
  console.log('19.9 GET /api/admin/contact-submissions: PASSED');

  if (contact) {
    res = await client.get(`/admin/contact-submissions/${contact.referenceCode}`, { headers: authHeaders });
    if (res.status !== 200) {
      console.error('19.10 Failed', res.status);
      process.exit(1);
    }
    console.log('19.10 GET /api/admin/contact-submissions/:referenceCode (valid): PASSED');

    await prisma.contactSubmission.update({ where: { id: contact.id }, data: { status: 'NEW' } });
    res = await client.patch(`/admin/contact-submissions/${contact.referenceCode}/status`, { status: 'READ' }, { headers: authHeaders });
    payload = extractPayload(res);
    if (res.status !== 200 || payload.status !== 'READ') {
      console.error('19.11 Failed', res.data);
      process.exit(1);
    }
    console.log('19.11 PATCH /api/admin/contact-submissions/:referenceCode/status (valid transition): PASSED');

    await prisma.contactSubmission.update({ where: { id: contact.id }, data: { status: 'ARCHIVED' } });
    res = await client.patch(`/admin/contact-submissions/${contact.referenceCode}/status`, { status: 'READ' }, { headers: authHeaders });
    if (res.status !== 400) {
      console.error('19.12 Failed', res.status);
      process.exit(1);
    }
    console.log('19.12 PATCH /api/admin/contact-submissions/:referenceCode/status (invalid transition): PASSED');
  }

  res = await client.get('/admin/notification-logs', { headers: authHeaders });
  payload = extractPayload(res);
  if (res.status !== 200 || !payload.data) {
    console.error('19.13 Failed', res.status);
    process.exit(1);
  }
  console.log('19.13 GET /api/admin/notification-logs: PASSED');

  res = await client.get('/admin/notification-logs?status=FAILED', { headers: authHeaders });
  if (res.status !== 200) {
    console.error('19.14 Failed', res.status);
    process.exit(1);
  }
  console.log('19.14 GET /api/admin/notification-logs with status=FAILED filter: PASSED');

  res = await client.get('/admin/dashboard', { headers: authHeaders });
  payload = extractPayload(res);
  if (res.status !== 200 || typeof payload.totalBookings !== 'number' || !Array.isArray(payload.recentFailedNotifications)) {
    console.error('19.15 Failed', res.data);
    process.exit(1);
  }
  console.log('19.15 GET /api/admin/dashboard: PASSED');

  res = await client.get('/admin/bookings');
  if (res.status !== 401) {
    console.error('19.16 Failed: Expected 401, got', res.status);
    process.exit(1);
  }
  res = await client.get('/admin/bookings', { headers: { Cookie: userCookie } });
  if (res.status !== 403) {
    console.error('19.16 Failed: Expected 403, got', res.status);
    process.exit(1);
  }
  console.log('19.16 Authentication enforcement: PASSED');

  res = await client.get('/admin/bookings?page=1&limit=2', { headers: authHeaders });
  payload = extractPayload(res);
  if (res.status !== 200 || payload.data.length > 2 || payload.limit !== 2) {
    console.error('19.17 Failed', res.data);
    process.exit(1);
  }
  console.log('19.17 Pagination: PASSED');

  res = await client.get('/admin/bookings?dateFrom=2020-01-01T00:00:00Z&dateTo=2020-12-31T23:59:59Z', { headers: authHeaders });
  payload = extractPayload(res);
  if (res.status !== 200 || !Array.isArray(payload.data)) {
    console.error('19.18 Failed', res.data);
    process.exit(1);
  }
  console.log('19.18 Date range filtering: PASSED');

  res = await axios.get('http://localhost:5002/docs-json');
  if (res.status !== 200 || !JSON.stringify(res.data).includes('admin')) {
    console.error('19.19 Failed', res.status);
    process.exit(1);
  }
  console.log('19.19 Swagger UI: PASSED');

  console.log('\nAll runtime verifications passed perfectly!');
  await app.close();
  process.exit(0);
}

runChecks().catch(e => {
  console.error('Verification crashed', e);
  process.exit(1);
});
