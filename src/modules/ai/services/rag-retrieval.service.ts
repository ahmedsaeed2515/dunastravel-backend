import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GroundingSource {
  id: string;
  title: string;
  category: string;
  content: string;
  score: number;
}

@Injectable()
export class RagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¿¡]/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    const norm = this.normalizeText(text);
    return norm.split(/\s+/).filter((w) => w.length > 1);
  }

  async retrieveRelevantKnowledge(
    userMessage: string,
    locale: string = 'en',
    limit: number = 4,
  ): Promise<GroundingSource[]> {
    try {
      const lang = locale.split('-')[0].toLowerCase();
      const tokens = this.tokenize(userMessage);

      if (tokens.length === 0) return [];

      // Query published knowledge base items matching locale or fallback to 'en'
      const items = await this.prisma.knowledgeBaseItem.findMany({
        where: {
          status: 'PUBLISHED',
          isExcludedFromAi: false,
          OR: [{ locale: lang }, { locale: 'en' }],
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          priority: true,
          tags: true,
        },
      });

      if (items.length === 0) return [];

      // Score items by relevance
      const scored = items.map((item: any) => {
        let score = item.priority || 0;
        const normTitle = this.normalizeText(item.title);
        const normContent = this.normalizeText(item.content);
        const normTags = (item.tags || []).map((t: string) => this.normalizeText(t));

        tokens.forEach((token: string) => {
          if (normTitle.includes(token)) score += 5;
          if (normTags.some((tag: string) => tag.includes(token))) score += 3;
          if (normContent.includes(token)) score += 1;
        });

        return {
          id: item.id,
          title: item.title,
          category: item.category,
          content: item.content,
          score,
        };
      });

      const matched = scored
        .filter((x: { score: number }) => x.score > 0)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, limit);

      return matched;
    } catch (err: any) {
      this.logger.error(`Error retrieving RAG knowledge: ${err.message}`);
      return [];
    }
  }
}
