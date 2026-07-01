import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generateDocs() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder().setTitle('Dunas Travel').build();
  const document = SwaggerModule.createDocument(app, config);
  fs.writeFileSync('docs/swagger.json', JSON.stringify(document));
  console.log('Swagger generated');
  await app.close();
  process.exit(0);
}
generateDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
