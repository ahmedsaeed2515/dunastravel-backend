import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import { SendChatMessageDto, SubmitLeadDto, HandoffRequestDto } from './dto/public-chat.dto';

@ApiTags('Public AI Chatbot')
@Controller('ai/chat')
@Public()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PublicChatController {
  constructor(private readonly chatOrchestrator: ChatOrchestratorService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public AI chatbot welcome configuration & suggestions' })
  async getChatConfig(@Query('locale') locale?: string) {
    const config = await this.chatOrchestrator.getOrCreateConfig();
    const lang = (locale || 'en').toLowerCase().split('-')[0];
    const welcome = (config.welcomeMessages as any)?.[lang] || (config.welcomeMessages as any)?.en || config.fallbackMessage;
    const suggestions = (config.suggestedQuestions as any)?.[lang] || (config.suggestedQuestions as any)?.en || [];

    return {
      welcomeMessage: welcome,
      suggestedQuestions: suggestions,
      isPublicEnabled: config.isPublicEnabled,
      salesPersonality: config.salesPersonality,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get past conversation message transcript for a visitor session' })
  async getChatHistory(@Query('sessionId') sessionId: string) {
    return this.chatOrchestrator.getConversationHistory(sessionId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send message to AI travel chatbot' })
  @ApiOkResponse({ description: 'Structured AI assistant reply with grounded tour & destination recommendations' })
  async sendMessage(@Body() dto: SendChatMessageDto) {
    return this.chatOrchestrator.processVisitorMessage(dto);
  }

  @Post('lead')
  @ApiOperation({ summary: 'Submit visitor contact info for CRM lead qualification' })
  async submitLead(@Body() dto: SubmitLeadDto) {
    return this.chatOrchestrator.submitLead(dto.sessionId, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      nationality: dto.nationality,
    });
  }

  @Post('handoff')
  @ApiOperation({ summary: 'Request human sales consultant handoff' })
  async requestHandoff(@Body() dto: HandoffRequestDto) {
    return this.chatOrchestrator.requestHumanHandoff(dto.sessionId);
  }
}
