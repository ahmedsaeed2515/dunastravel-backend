import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generateDocs() {
  const app = await NestFactory.create(AppModule, { logger: false });
  
  const config = new DocumentBuilder()
    .setTitle('Dunas Travel API')
    .setDescription('Full API documentation for Dunas Travel Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  
  fs.writeFileSync(
    path.join(__dirname, 'docs', 'swagger.json'),
    JSON.stringify(document, null, 2)
  );

  console.log('Successfully generated swagger.json');
  await app.close();
}

generateDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
