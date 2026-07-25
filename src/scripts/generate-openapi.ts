import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

async function generateOpenApi() {
  const moduleRef = await Test.createTestingModule({
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
  const outputPath = path.join(process.cwd(), 'openapi-spec.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI document successfully written to: ${outputPath}`);
  await app.close();
}

generateOpenApi().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
