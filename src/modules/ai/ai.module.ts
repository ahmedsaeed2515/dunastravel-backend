import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PublicAiController } from './public-ai.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController, PublicAiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
