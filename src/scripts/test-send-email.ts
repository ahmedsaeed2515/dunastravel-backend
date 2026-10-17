import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { NotificationsService } from '../modules/notifications/notifications.service';

async function testEmail() {
  console.log('Testing sendVerificationEmail...');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const service = moduleRef.get(NotificationsService);
  try {
    await service.sendVerificationEmail(
      'test@example.com',
      'Test User',
      '123456',
    );
    console.log('Email sent successfully!');
  } catch (err: any) {
    console.error('Error sending email:', err.message, err.stack);
  } finally {
    await moduleRef.close();
  }
}

testEmail();
