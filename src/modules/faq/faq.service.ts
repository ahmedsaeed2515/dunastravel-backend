import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { ReorderFaqDto } from './dto/reorder-faq.dto';
import {
  extractI18nFallback,
  sanitizeHtmlContent,
} from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeJsonb(jsonb: unknown): Prisma.InputJsonValue {
    if (!jsonb || typeof jsonb !== 'object') {
      return (jsonb || {}) as Prisma.InputJsonValue;
    }
    const record = jsonb as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const key of Object.keys(record)) {
      if (typeof record[key] === 'string') {
        result[key] = sanitizeHtmlContent(record[key] as string);
      }
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
        questionJsonb: this.sanitizeJsonb(dto.questionJsonb),
        answerJsonb: this.sanitizeJsonb(dto.answerJsonb),
        category: dto.category || null,
        sortOrder: dto.sortOrder || 0,
        isPublished: dto.isPublished !== undefined ? dto.isPublished : true,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateFaqDto) {
    await this.findOneAdmin(id);

    return this.prisma.faqItem.update({
      where: { id },
      data: {
        ...(dto.questionJsonb && {
          questionJsonb: this.sanitizeJsonb(dto.questionJsonb),
        }),
        ...(dto.answerJsonb && {
          answerJsonb: this.sanitizeJsonb(dto.answerJsonb),
        }),
        ...(dto.category !== undefined && { category: dto.category }),
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
