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
      .replace(/ئ/g, 'ء')
      .replace(/ؤ/g, 'ء')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¿¡]/g, ' ')
      .trim();
  }

  private stemArabicToken(token: string): string {
    let t = this.normalizeText(token);
    if (!t) return '';

    // Strip common Arabic prefixes
    if (t.startsWith('ال') && t.length > 3) t = t.substring(2);
    if (t.startsWith('بال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('وال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('كال') && t.length > 4) t = t.substring(3);
    if (t.startsWith('لل') && t.length > 3) t = t.substring(2);
    if (t.startsWith('و') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ب') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ل') && t.length > 3) t = t.substring(1);
    if (t.startsWith('ف') && t.length > 3) t = t.substring(1);

    // Common synonyms / mappings
    if (/^(حجز|احجز|احجزلي|الحجز|حجوزات|يحجز|تحجز)$/.test(t)) return 'حجز';
    if (/^(الغاء|إلغاء|الالغاء|يلغي|تلغي|استرداد|استرجاع)$/.test(t))
      return 'الغاء';
    if (/^(دفع|الدفع|يدفع|مدفوعات|كاش|كارت|فيزا)$/.test(t)) return 'دفع';
    if (/^(سعر|اسعار|الاسعار|تكلفة|بكام|بكم)$/.test(t)) return 'سعر';
    if (/^(تاشيرة|تأشيرة|تاشيرات|فيزا)$/.test(t)) return 'فيزا';
    if (/^(طيران|طيارة|مطار|طائره)$/.test(t)) return 'طيران';
    if (/^(فندق|فنادق|اقامة)$/.test(t)) return 'فندق';
    if (/^(رحلة|رحلات|جولة|برنامج|باقة|باكدج)$/.test(t)) return 'رحلة';
    if (/^(نيل|نيلية|نايل|كروز)$/.test(t)) return 'نيل';
    if (/^(اهرام|اهرامات|الجيزة|جيزة)$/.test(t)) return 'اهرامات';
    if (/^(مخصص|تفصيل|تخصيص|خاص|vip)$/.test(t)) return 'تخصيص';

    return t;
  }

  private tokenize(text: string): string[] {
    const norm = this.normalizeText(text);
    const raw = norm.split(/\s+/).filter((w) => w.length > 1);

    const tokens: string[] = [];
    raw.forEach((w) => {
      tokens.push(w);
      const stemmed = this.stemArabicToken(w);
      if (stemmed && stemmed !== w) {
        tokens.push(stemmed);
      }
    });

    return Array.from(new Set(tokens));
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

      // Query published knowledge base items matching locale or fallback
      const items = await this.prisma.knowledgeBaseItem.findMany({
        where: {
          status: 'PUBLISHED',
          isExcludedFromAi: false,
          OR: [{ locale: lang }, { locale: 'en' }, { locale: 'ar' }],
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
        let score = (item.priority || 0) * 2;
        const normTitle = this.normalizeText(item.title);
        const normContent = this.normalizeText(item.content);
        const normTags = (item.tags || []).map((t: string) =>
          this.normalizeText(t),
        );

        tokens.forEach((token: string) => {
          if (normTitle.includes(token)) score += 12;
          if (
            normTags.some(
              (tag: string) => tag.includes(token) || token.includes(tag),
            )
          )
            score += 8;
          if (normContent.includes(token)) score += 3;
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
