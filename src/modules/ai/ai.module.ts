import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PublicAiController } from './public-ai.controller';
import { PublicChatController } from './public-chat.controller';
import { AdminAiController } from './admin-ai.controller';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { AiUsageQuotaService } from './ai-usage-quota.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { UniversalAiProvider } from './providers/universal-ai.provider';
import { AiKeyPoolService } from './services/ai-key-pool.service';
import { KnowledgeTranslationService } from './services/knowledge-translation.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { TourCatalogToolService } from './services/tour-catalog-tool.service';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { TourKnowledgeIngestionService } from './services/tour-knowledge-ingestion.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [
    AiController,
    PublicAiController,
    PublicChatController,
    AdminAiController,
    AdminKnowledgeController,
  ],
  providers: [
    AiService,
    AiUsageQuotaService,
    AnthropicProvider,
    UniversalAiProvider,
    AiKeyPoolService,
    KnowledgeTranslationService,
    RagRetrievalService,
    TourCatalogToolService,
    ChatOrchestratorService,
    TourKnowledgeIngestionService,
  ],
  exports: [
    AiService,
    ChatOrchestratorService,
    UniversalAiProvider,
    AiKeyPoolService,
    KnowledgeTranslationService,
    RagRetrievalService,
    TourCatalogToolService,
    TourKnowledgeIngestionService,
  ],
})
export class AiModule {}
