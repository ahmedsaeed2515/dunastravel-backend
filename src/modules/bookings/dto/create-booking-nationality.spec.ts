import {
  ValidationPipe,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { CreateBookingDto } from './create-booking.dto';

describe('CONTRACT-01: Nationality Contract Validation (ValidationPipe)', () => {
  let targetPipe: ValidationPipe;
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateBookingDto,
  };

  beforeAll(() => {
    targetPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
  });

  const baseBookingPayload = {
    tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    arrivalDate: '2026-09-01',
    adults: 2,
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1234567890',
    language: 'en',
  };

  it('REJECTS type=booking when nationality is missing (fails at HTTP validation boundary)', async () => {
    const payload = {
      ...baseBookingPayload,
      type: 'booking',
    };

    try {
      await targetPipe.transform(payload, metadata);
      fail('Expected ValidationPipe to throw BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = err.getResponse();
      const messages = Array.isArray(res.message) ? res.message : [res.message];
      expect(
        messages.some(
          (m: string) =>
            m.includes('NATIONALITY_REQUIRED') || m.includes('nationality'),
        ),
      ).toBe(true);
    }
  });

  it('REJECTS type=booking when nationality is empty or whitespace-only', async () => {
    const payload = {
      ...baseBookingPayload,
      type: 'booking',
      nationality: '   ',
    };

    try {
      await targetPipe.transform(payload, metadata);
      fail('Expected ValidationPipe to throw BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = err.getResponse();
      const messages = Array.isArray(res.message) ? res.message : [res.message];
      expect(
        messages.some(
          (m: string) =>
            m.includes('NATIONALITY_REQUIRED') || m.includes('nationality'),
        ),
      ).toBe(true);
    }
  });

  it('ALLOWS type=inquiry when nationality is omitted (non-booking types unaffected)', async () => {
    const payload = {
      ...baseBookingPayload,
      type: 'inquiry',
      inquiryMessage: 'I would like to inquire about this itinerary.',
    };

    const transformed = (await targetPipe.transform(
      payload,
      metadata,
    )) as CreateBookingDto;
    expect(transformed).toBeDefined();
    expect(transformed.type).toBe('inquiry');
  });

  it('ALLOWS type=booking with valid trimmed nationality', async () => {
    const payload = {
      ...baseBookingPayload,
      type: 'booking',
      nationality: '  Egyptian  ',
    };

    const transformed = (await targetPipe.transform(
      payload,
      metadata,
    )) as CreateBookingDto;
    expect(transformed).toBeDefined();
    expect(transformed.nationality).toBe('Egyptian');
  });
});
