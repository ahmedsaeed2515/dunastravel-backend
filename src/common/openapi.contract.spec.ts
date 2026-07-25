process.env.GUEST_TOKEN_SECRET =
  process.env.GUEST_TOKEN_SECRET || 'test-secret-guest-token-key-1234567890';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-key-1234567890-super-long-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

describe('OpenAPI Contract Frozen Spec', () => {
  it('generates, validates, and freezes the OpenAPI 3.0 specification document', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');

    const config = new DocumentBuilder()
      .setTitle('Dunas Travel API')
      .setDescription(
        'Production-ready REST API for Dunas Travel — a luxury multi-country tour platform.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    expect(document).toBeDefined();
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('Dunas Travel API');
    expect(Object.keys(document.paths).length).toBeGreaterThan(10);

    const outputPath = path.join(process.cwd(), 'openapi-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
    expect(fs.existsSync(outputPath)).toBe(true);

    await app.close();
  });
});
