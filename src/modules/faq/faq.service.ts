import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { ReorderFaqDto } from './dto/reorder-faq.dto';
import {
  extractI18nFallback,
  sanitizeHtmlContent,
  sanitizePlainText,
} from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeJsonb(
    jsonb: unknown,
    richText: boolean,
  ): Prisma.InputJsonValue {
    if (!jsonb || typeof jsonb !== 'object' || Array.isArray(jsonb)) {
      throw new BadRequestException('Invalid localized FAQ content');
    }
    const record = jsonb as Record<string, unknown>;
    const entries = Object.entries(record);
    const supportedLocales = ['en', 'ar', 'es', 'pt', 'it'];
    if (
      entries.length === 0 ||
      entries.length > supportedLocales.length ||
      entries.some(
        ([key, value]) =>
          !supportedLocales.includes(key) ||
          typeof value !== 'string' ||
          value.length > (richText ? 20_000 : 500),
      )
    ) {
      throw new BadRequestException('Invalid localized FAQ content');
    }
    const result: Record<string, string> = {};
    for (const [key, value] of entries as [string, string][]) {
      result[key] = richText
        ? sanitizeHtmlContent(value)
        : sanitizePlainText(value);
    }
    if (!result.en?.trim()) {
      throw new BadRequestException('English FAQ content is required');
    }
    return result as Prisma.InputJsonValue;
  }

  // --- PUBLIC API ---

  async findAllPublic(category?: string, locale: string = 'en') {
    const where: Prisma.FaqItemWhereInput = {
      isPublished: true,
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    const items = await this.prisma.faqItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((item) => ({
      id: item.id,
      category: item.category,
      question: extractI18nFallback(item.questionJsonb, locale),
      answer: extractI18nFallback(item.answerJsonb, locale),
      sortOrder: item.sortOrder,
    }));
  }

  // --- ADMIN API ---

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 20,
    category?: string,
  ) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.FaqItemWhereInput = { deletedAt: null };
    if (category) where.category = category;

    const [total, items] = await Promise.all([
      this.prisma.faqItem.count({ where }),
      this.prisma.faqItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOneAdmin(id: string) {
    const item = await this.prisma.faqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException(`FAQ item '${id}' not found`);
    return item;
  }

  async createAdmin(dto: CreateFaqDto) {
    return this.prisma.faqItem.create({
      data: {
        questionJsonb: this.sanitizeJsonb(dto.questionJsonb, false),
        answerJsonb: this.sanitizeJsonb(dto.answerJsonb, true),
        category: dto.category
          ? sanitizePlainText(dto.category).slice(0, 100)
          : null,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateFaqDto) {
    await this.findOneAdmin(id);

    return this.prisma.faqItem.update({
      where: { id },
      data: {
        ...(dto.questionJsonb && {
          questionJsonb: this.sanitizeJsonb(dto.questionJsonb, false),
        }),
        ...(dto.answerJsonb && {
          answerJsonb: this.sanitizeJsonb(dto.answerJsonb, true),
        }),
        ...(dto.category !== undefined && {
          category: sanitizePlainText(dto.category).slice(0, 100),
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
      },
    });
  }

  async reorderAdmin(dto: ReorderFaqDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.faqItem.updateMany({
          where: { id: item.id, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true, count: dto.items.length };
  }

  async softDeleteAdmin(id: string) {
    await this.findOneAdmin(id);

    await this.prisma.faqItem.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    return { success: true, message: `FAQ item '${id}' deleted.` };
  }
}
