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
import { ModelRegistryService } from './services/model-registry.service';
import { ModelRoutingService } from './services/model-routing.service';
import { AgentRegistryService } from './services/agent-registry.service';
import { LiveCatalogRetrieverService } from './services/live-catalog-retriever.service';
import { HybridRagEngineService } from './services/hybrid-rag-engine.service';
import { PromptEngineService } from './services/prompt-engine.service';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [ConfigModule, PrismaModule, AvailabilityModule],
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
    ModelRegistryService,
    ModelRoutingService, // NEW: Model routing policy engine
    AgentRegistryService,
    LiveCatalogRetrieverService,
    HybridRagEngineService,
    PromptEngineService,
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
    ModelRegistryService,
    ModelRoutingService, // NEW: exported for use in other modules
    AgentRegistryService,
    LiveCatalogRetrieverService,
    HybridRagEngineService,
    PromptEngineService,
  ],
})
export class AiModule {}
