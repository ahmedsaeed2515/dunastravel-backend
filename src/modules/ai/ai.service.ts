import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import { GenerateItineraryDto } from './dto/ai.dto';

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /override\s+rules/i,
  /forget\s+all\s+rules/i,
  /<script>/i,
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic?: Anthropic;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey =
      this.configService.get<string>('ANTHROPIC_API_KEY') ||
      this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.isConfigured = true;
    } else {
      this.logger.warn(
        'AI API Key (ANTHROPIC_API_KEY / GEMINI_API_KEY) is not configured.',
      );
      this.isConfigured = false;
    }
  }

  private validateInput(text?: string, fieldName = 'input') {
    if (!text) return;
    if (text.length > 1000) {
      throw new BadRequestException(
        `Field '${fieldName}' exceeds maximum length of 1000 characters`,
      );
    }
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        throw new BadRequestException(
          `Security violation: malicious input pattern detected in '${fieldName}'`,
        );
      }
    }
  }

  async generateItinerary(dto: GenerateItineraryDto) {
    this.validateInput(dto.preferences, 'preferences');
    if (dto.destinations) {
      dto.destinations.forEach((d) => this.validateInput(d, 'destinations'));
    }

    if (!this.isConfigured || !this.anthropic) {
      throw new ServiceUnavailableException(
        'AI Provider is currently unavailable or unconfigured.',
      );
    }

    // Catalog Grounding: Query available active tours matching destinations
    const matchedTours = await this.prisma.tour.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: dto.destinations.map((dest) => ({
          city: { contains: dest, mode: 'insensitive' as const },
        })),
      },
      take: 5,
      select: { slug: true, basePriceUsd: true, category: true },
    });

    const catalogContext =
      matchedTours.length > 0
        ? `Grounded Active Catalog Tours: ${matchedTours.map((t) => `${t.slug} (${t.category}, $${String(t.basePriceUsd)})`).join(', ')}`
        : 'No exact catalog matches found.';

    try {
      const prompt = `Act as a luxury travel concierge for Dunas Travel.
Generate a ${dto.days}-day structured itinerary for ${dto.destinations.join(', ')}.
Travelers: ${dto.pax || 2}. Budget: ${dto.budgetUsd ? '$' + dto.budgetUsd : 'Luxury'}.
Preferences: ${dto.preferences || 'None'}.
${catalogContext}

Return ONLY valid JSON matching this structure:
{
  "title": "...",
  "description": "...",
  "days": [
    {
      "dayNumber": 1,
      "location": "...",
      "morning": "...",
      "afternoon": "...",
      "evening": "...",
      "hotelRecommendation": "..."
    }
  ]
}`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(new Error('AI Provider request timed out after 30 seconds')),
          30000,
        );
      });

      const response = (await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1500,
          temperature: 0.7,
          system:
            'You are a senior luxury travel designer. Return ONLY raw JSON without markdown.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ])) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '{}';

      try {
        return JSON.parse(content) as Record<string, unknown>;
      } catch {
        this.logger.error(`Failed to parse AI JSON response: ${content}`);
        throw new InternalServerErrorException('AI returned unexpected format');
      }
    } catch (error: unknown) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`Failed to generate itinerary: ${err.message}`);
      throw new ServiceUnavailableException(
        'Failed to reach AI Provider. Service currently unavailable.',
      );
    }
  }

  async analyzeCustomer(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: {
        bookings: {
          include: { tour: true },
        },
        customerNotes: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    if (!this.isConfigured || !this.anthropic) {
      throw new ServiceUnavailableException(
        'AI Provider is currently unavailable or unconfigured.',
      );
    }

    const bookingsSummary = user.bookings
      .map(
        (b) =>
          `${b.tour.country || 'Egypt'} (${b.tour.category || 'Luxury'}) - $${String(b.totalAmountUsd)}`,
      )
      .join(', ');

    const notesSummary = user.customerNotes.map((n) => n.content).join(' | ');

    try {
      const prompt = `Analyze this luxury travel customer profile and provide actionable CRM insights.
Customer Name: ${user.name}
Preferred Destination: ${user.preferredDestination || 'Unknown'}
Tags: ${user.tags.join(', ') || 'None'}
Past Bookings: ${bookingsSummary || 'No past bookings'}
Internal Agent Notes: ${notesSummary || 'No notes'}

Return ONLY valid JSON matching this structure:
{
  "summary": "2 sentence executive summary of the client",
  "suggestedDestinations": ["Dest 1", "Dest 2", "Dest 3"],
  "salesStrategy": "1 paragraph on how to pitch the next trip",
  "churnRisk": "Low / Medium / High"
}`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(new Error('AI Provider request timed out after 30 seconds')),
          30000,
        );
      });

      const response = (await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          temperature: 0.5,
          system:
            'You are a luxury travel CRM strategist. Return ONLY raw JSON without markdown.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ])) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '{}';

      try {
        return JSON.parse(content) as Record<string, unknown>;
      } catch {
        this.logger.error(`Failed to parse AI JSON response: ${content}`);
        throw new InternalServerErrorException('AI returned unexpected format');
      }
    } catch (error: unknown) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`Failed to analyze customer: ${err.message}`);
      throw new ServiceUnavailableException(
        'Failed to reach AI Provider. Service currently unavailable.',
      );
    }
  }

  async translateHieroglyphics(dto: { text: string }) {
    this.validateInput(dto.text, 'text');

    if (!this.isConfigured || !this.anthropic) {
      throw new ServiceUnavailableException(
        'AI Provider is currently unavailable or unconfigured.',
      );
    }

    try {
      const prompt = `Translate the following name into ancient Egyptian hieroglyphics using unicode characters. Only return the unicode characters and nothing else. Name: ${dto.text}`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(new Error('AI Provider request timed out after 30 seconds')),
          30000,
        );
      });

      const response = (await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100,
          temperature: 0.1,
          system:
            'You are an ancient Egyptian scribe. Return ONLY unicode hieroglyphic characters. No explanations.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ])) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : '';

      return { translation: content };
    } catch (error: unknown) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`Failed to translate hieroglyphics: ${err.message}`);
      throw new ServiceUnavailableException(
        'Failed to translate hieroglyphics.',
      );
    }
  }
}
