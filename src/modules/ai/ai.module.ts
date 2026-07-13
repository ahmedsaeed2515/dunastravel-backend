import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PublicAiController } from './public-ai.controller';

@Module({
  controllers: [AiController, PublicAiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
