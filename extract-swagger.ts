import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './src/app.module';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder().setTitle('Dunas API').build();
  const document = SwaggerModule.createDocument(app, config);
  fs.writeFileSync('../admin_api_collection.json', JSON.stringify(document, null, 2));
  await app.close();
}
bootstrap().catch(console.error);
