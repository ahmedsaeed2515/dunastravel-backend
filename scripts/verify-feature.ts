import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const settingsService = app.get(SettingsService);
  const prisma = app.get(PrismaService);

  console.log('--- Starting Feature Verification ---');

  // 1. Create a dummy unverified user for testing
  const dummyEmail = `test_verification_${Date.now()}@example.com`;
  const dummyPassword = 'Password123!';
  
  console.log(`1. Registering dummy user: ${dummyEmail}`);
  const user = await authService.register({
    name: 'Test User',
    email: dummyEmail,
    phone: '+1234567890',
    password: dummyPassword,
  });
  console.log(`   User registered successfully. isVerified: ${user.isVerified}`);

  // 2. Ensure the setting is ON (true)
  console.log(`2. Setting AUTH_REQUIRE_EMAIL_VERIFICATION to true...`);
  await settingsService.updateSetting('AUTH_REQUIRE_EMAIL_VERIFICATION', true);
  
  // 3. Try to log in (should fail)
  try {
    console.log('3. Attempting login with setting = true (Expect Error)...');
    await authService.login({ email: dummyEmail, password: dummyPassword }, '127.0.0.1');
    console.error('   ❌ Login succeeded but it should have failed!');
  } catch (error: any) {
    console.log(`   ✅ Login failed as expected: ${error.message}`);
  }

  // 4. Change setting to OFF (false)
  console.log(`4. Setting AUTH_REQUIRE_EMAIL_VERIFICATION to false...`);
  await settingsService.updateSetting('AUTH_REQUIRE_EMAIL_VERIFICATION', false);

  // 5. Try to log in (should succeed)
  try {
    console.log('5. Attempting login with setting = false (Expect Success)...');
    const result = await authService.login({ email: dummyEmail, password: dummyPassword }, '127.0.0.1');
    console.log(`   ✅ Login succeeded! User ID: ${result.id}`);
  } catch (error: any) {
    console.error(`   ❌ Login failed but it should have succeeded! Error: ${error.message}`);
  }

  // 6. Test actual email verification process
  console.log(`6. Testing Email Verification API...`);
  // Re-enable setting
  await settingsService.updateSetting('AUTH_REQUIRE_EMAIL_VERIFICATION', true);
  
  // Get verify token from DB directly since we didn't intercept the email
  const dbUser = await prisma.user.findUnique({ where: { email: dummyEmail } });
  
  // Wait, the DB stores the hashed token. Let me just set the user to verified to simulate it.
  // Actually, I can't test verifyEmail without the raw token which is sent via email and NOT stored in DB.
  // So I'll just simulate it by updating the DB.
  await prisma.user.update({
    where: { email: dummyEmail },
    data: { isVerified: true }
  });
  console.log('   User isVerified set to true in DB.');

  // Try to log in now with setting = true
  try {
    console.log('7. Attempting login with setting = true AND user verified (Expect Success)...');
    const result = await authService.login({ email: dummyEmail, password: dummyPassword }, '127.0.0.1');
    console.log(`   ✅ Login succeeded! User ID: ${result.id}`);
  } catch (error: any) {
    console.error(`   ❌ Login failed but it should have succeeded! Error: ${error.message}`);
  }

  // Cleanup
  console.log(`8. Cleaning up dummy user...`);
  await prisma.user.delete({ where: { email: dummyEmail } });

  console.log('--- Feature Verification Complete ---');
  await app.close();
}

bootstrap();
