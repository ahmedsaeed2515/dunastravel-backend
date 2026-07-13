import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import { GenerateItineraryDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic!: Anthropic;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.isConfigured = true;
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set. AI Features will return mocked responses.',
      );
      this.isConfigured = false;
    }
  }

  async generateItinerary(dto: GenerateItineraryDto) {
    if (!this.isConfigured) {
      return this.mockItinerary(dto);
    }

    try {
      const prompt = `Act as a luxury travel concierge for Dunas Travel (an elite B2B and B2C travel agency).
Generate a ${dto.days}-day structured itinerary for ${dto.destinations.join(', ')}.
Travelers: ${dto.pax || 2}. Budget: ${dto.budgetUsd ? '$' + dto.budgetUsd : 'Luxury'}.
Preferences: ${dto.preferences || 'None'}.

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
        setTimeout(() => reject(new Error('Anthropic API request timed out after 30 seconds')), 30000);
      });

      const response = await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1500,
          temperature: 0.7,
          system:
            'You are a senior luxury travel designer. Return ONLY raw JSON without any markdown formatting.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ]) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      try {
        return JSON.parse(content);
      } catch (parseError: any) {
        this.logger.error(`Failed to parse AI JSON response: ${content}`);
        throw new InternalServerErrorException('AI returned unexpected format');
      }
    } catch (error: any) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to generate itinerary: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate AI itinerary. Please try again.');
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

    // Build context
    const bookingsSummary = user.bookings
      .map(
        (b) => `${b.tour.country} (${b.tour.category}) - $${b.totalAmountUsd}`,
      )
      .join(', ');

    const notesSummary = user.customerNotes.map((n) => n.content).join(' | ');

    if (!this.isConfigured) {
      return {
        summary: `${user.name} is a valued customer with past travels including: ${bookingsSummary || 'None'}.`,
        suggestedDestinations: ['Maldives', 'Dubai', 'Swiss Alps'],
        salesStrategy: 'Focus on wellness and exclusive private tours.',
        churnRisk: 'Low',
      };
    }

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
        setTimeout(() => reject(new Error('Anthropic API request timed out after 30 seconds')), 30000);
      });

      const response = await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          temperature: 0.5,
          system:
            'You are a luxury travel CRM strategist. Return ONLY raw JSON without markdown.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ]) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text' ? response.content[0].text : '{}';
      
      try {
        return JSON.parse(content);
      } catch (parseError: any) {
        this.logger.error(`Failed to parse AI JSON response: ${content}`);
        throw new InternalServerErrorException('AI returned unexpected format');
      }
    } catch (error: any) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Failed to analyze customer: ${error.message}`);
      throw new InternalServerErrorException('Failed to analyze customer data.');
    }
  }

  private mockItinerary(dto: GenerateItineraryDto) {
    return {
      title: `Luxury Escape to ${dto.destinations.join(' & ')}`,
      description: 'An exclusive, hand-crafted journey (Mock Data)',
      days: Array.from({ length: dto.days }).map((_, i) => ({
        dayNumber: i + 1,
        location: dto.destinations[0] || 'Unknown',
        morning: 'Private guided tour of historical landmarks.',
        afternoon: 'Exclusive culinary experience.',
        evening: 'Sunset cruise with champagne.',
        hotelRecommendation: 'Four Seasons or similar 5-star property',
      })),
    };
  }

  async translateHieroglyphics(dto: { text: string }) {
    if (!this.isConfigured) {
      return { translation: 'Mocked Hieroglyphics for ' + dto.text };
    }

    try {
      const prompt = `Translate the following name into ancient Egyptian hieroglyphics using unicode characters. Only return the unicode characters and nothing else. Name: ${dto.text}`;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Anthropic API request timed out after 30 seconds')), 30000);
      });

      const response = await Promise.race([
        this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100,
          temperature: 0.1,
          system: 'You are an ancient Egyptian scribe. Return ONLY the unicode hieroglyphic characters. No explanations.',
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ]) as Anthropic.Messages.Message;

      const content =
        response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      
      return { translation: content };
    } catch (error: any) {
      this.logger.error(`Failed to translate hieroglyphics: ${error.message}`);
      throw new InternalServerErrorException('Failed to translate hieroglyphics.');
    }
  }
}
