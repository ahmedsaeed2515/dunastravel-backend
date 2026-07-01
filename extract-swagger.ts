import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './src/app.module';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dunas Travel API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  fs.writeFileSync('swagger-spec.json', JSON.stringify(document, null, 2));
  
  await app.close();
}

bootstrap().then(() => console.log('Swagger generated!')).catch(e => {
  console.error(e);
  process.exit(1);
});
