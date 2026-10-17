import { Controller, Post, Get, Body, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { ChatOrchestratorService } from './services/chat-orchestrator.service';
import {
  SendChatMessageDto,
  SubmitLeadDto,
  HandoffRequestDto,
  BookTourChatDto,
} from './dto/public-chat.dto';
import { Response } from 'express';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordFeedbackRequestDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  messageId?: string;

  @IsInt()
  @Min(-1)
  @Max(1)
  rating!: number; // +1 or -1

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}

@ApiTags('Public AI Chatbot')
@Controller('ai/chat')
@Public()
@SkipCsrf()
@Throttle({ default: { limit: 45, ttl: 60_000 } })
export class PublicChatController {
  constructor(private readonly chatOrchestrator: ChatOrchestratorService) {}

  @Get('status')
  @ApiOperation({
    summary:
      'Get GuideR global availability status (ACTIVE / DISABLED / MAINTENANCE)',
  })
  async getStatus() {
    return this.chatOrchestrator.getPublicAvailabilityStatus();
  }

  @Get('personas')
  @ApiOperation({
    summary: 'Get available AI Concierge personas & conversational styles',
  })
  async getPersonas(@Query('locale') locale?: string) {
    return this.chatOrchestrator.getActivePersonas(locale);
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get public AI chatbot welcome configuration & suggestions',
  })
  async getChatConfig(@Query('locale') locale?: string) {
    const [config, availability] = await Promise.all([
      this.chatOrchestrator.getOrCreateConfig(),
      this.chatOrchestrator.getPublicAvailabilityStatus(),
    ]);
    const lang = (locale || 'en').toLowerCase().split('-')[0];
    const welcome =
      config.welcomeMessages?.[lang] ||
      config.welcomeMessages?.en ||
      config.fallbackMessage;
    const suggestions =
      config.suggestedQuestions?.[lang] || config.suggestedQuestions?.en || [];

    return {
      welcomeMessage: welcome,
      suggestedQuestions: suggestions,
      isPublicEnabled: availability.enabled,
      availability,
      isInChatBookingEnabled: false, // GuideR does NOT book trips directly; navigates to tour pages
      salesPersonality: config.salesPersonality,
      personas: this.chatOrchestrator.getActivePersonas(locale),
    };
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get past conversation message transcript for a visitor session',
  })
  async getChatHistory(@Query('sessionId') sessionId: string) {
    return this.chatOrchestrator.getConversationHistory(sessionId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send message to AI travel chatbot' })
  @ApiOkResponse({
    description:
      'Structured AI assistant reply with grounded tour & destination recommendations',
  })
  async sendMessage(@Body() dto: SendChatMessageDto) {
    return this.chatOrchestrator.processVisitorMessage(dto);
  }

  @Post('book')
  @ApiOperation({
    summary:
      'Deprecated: GuideR no longer initiates direct bookings. Redirects traveler to official tour page.',
  })
  @ApiOkResponse({
    description:
      'Redirection advisory to the official website tour booking flow',
  })
  async bookTour(@Body() dto: BookTourChatDto) {
    return this.chatOrchestrator.bookTourFromChat(dto);
  }

  @Post('stream')
  @ApiOperation({
    summary:
      'Stream message from AI travel chatbot via Server-Sent Events (SSE)',
  })
  async streamMessage(@Body() dto: SendChatMessageDto, @Res() res: Response) {
    return this.chatOrchestrator.streamVisitorMessage(dto, res);
  }

  @Post('feedback')
  @ApiOperation({
    summary: 'Record traveler message rating (+1 / -1) and feedback',
  })
  async recordFeedback(@Body() dto: RecordFeedbackRequestDto) {
    return this.chatOrchestrator.recordFeedback(dto);
  }

  @Post('lead')
  @ApiOperation({
    summary: 'Submit visitor contact info for CRM lead qualification',
  })
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
