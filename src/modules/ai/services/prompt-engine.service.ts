import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PromptTemplateSections {
  identity?: string;
  role?: string;
  businessContext?: string;
  toneAndPersonality?: string;
  conversationRules?: string;
  languageRules?: string;
  knowledgeAndGroundingRules?: string;
  bookingRules?: string;
  salesRules?: string;
  safetyAndGuardrails?: string;
  outputFormatting?: string;
}

export interface CompilePromptOptions {
  agentName?: string;
  visitorLanguage?: string;
  currentDate?: string;
  businessName?: string;
  groundedKnowledge?: string;
  customVariables?: Record<string, string>;
}

@Injectable()
export class PromptEngineService {
  private readonly logger = new Logger(PromptEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compiles structured prompt sections into unified system prompt text
   */
  compileSectionsToPrompt(sections: PromptTemplateSections): string {
    const parts: string[] = [];

    if (sections.identity) {
      parts.push(`=== 1. IDENTITY & PERSONA ===\n${sections.identity}`);
    }
    if (sections.role) {
      parts.push(`=== 2. CORE ROLE & OBJECTIVE ===\n${sections.role}`);
    }
    if (sections.businessContext) {
      parts.push(`=== 3. BUSINESS CONTEXT ===\n${sections.businessContext}`);
    }
    if (sections.toneAndPersonality) {
      parts.push(
        `=== 4. TONE & COMMUNICATION STYLE ===\n${sections.toneAndPersonality}`,
      );
    }
    if (sections.conversationRules) {
      parts.push(
        `=== 5. CONVERSATION RULES ===\n${sections.conversationRules}`,
      );
    }
    if (sections.languageRules) {
      parts.push(
        `=== 6. MULTILINGUAL INSTRUCTIONS ===\n${sections.languageRules}`,
      );
    }
    if (sections.knowledgeAndGroundingRules) {
      parts.push(
        `=== 7. KNOWLEDGE & ZERO-HALLUCINATION POLICY ===\n${sections.knowledgeAndGroundingRules}`,
      );
    }
    if (sections.bookingRules) {
      parts.push(
        `=== 8. BOOKING & PRICING RULES ===\n${sections.bookingRules}`,
      );
    }
    if (sections.salesRules) {
      parts.push(`=== 9. SALES & UP-SELLING RULES ===\n${sections.salesRules}`);
    }
    if (sections.safetyAndGuardrails) {
      parts.push(
        `=== 10. SAFETY, SECURITY & PROMPT-INJECTION GUARD ===\n${sections.safetyAndGuardrails}`,
      );
    }
    if (sections.outputFormatting) {
      parts.push(`=== 11. OUTPUT FORMATTING ===\n${sections.outputFormatting}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Safe variable substitution engine
   */
  renderTemplate(template: string, options: CompilePromptOptions): string {
    if (!template) return '';

    let rendered = template;
    const todayStr =
      options.currentDate || new Date().toISOString().split('T')[0];

    rendered = rendered.replace(
      /\{\{\s*agent_name\s*\}\}/gi,
      options.agentName || 'GuideR',
    );
    rendered = rendered.replace(
      /\{\{\s*visitor_language\s*\}\}/gi,
      options.visitorLanguage || 'en',
    );
    rendered = rendered.replace(
      /\{\{\s*business_name\s*\}\}/gi,
      options.businessName || 'Dunas Travel',
    );
    rendered = rendered.replace(/\{\{\s*current_date\s*\}\}/gi, todayStr);
    rendered = rendered.replace(
      /\{\{\s*grounded_knowledge\s*\}\}/gi,
      options.groundedKnowledge || 'No specific catalog items matched.',
    );

    if (options.customVariables) {
      for (const [key, val] of Object.entries(options.customVariables)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        rendered = rendered.replace(regex, val);
      }
    }

    return rendered;
  }

  /**
   * Get all prompt versions with optional filter by agentSlug and status
   */
  async getPromptVersions(agentSlug?: string, status?: string) {
    const where: any = {};
    if (agentSlug && agentSlug !== 'ALL') where.agentSlug = agentSlug;
    if (status && status !== 'ALL') where.status = status;

    return (this.prisma as any).aiPromptVersion.findMany({
      where,
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Create a new draft prompt version
   */
  async createPromptDraft(dto: {
    name: string;
    systemPrompt: string;
    agentSlug?: string;
    changeNote?: string;
    sections?: PromptTemplateSections;
    variables?: Record<string, string>;
    userId?: string;
  }) {
    if (!dto.name || !dto.systemPrompt) {
      throw new BadRequestException(
        'Prompt name and systemPrompt content are required.',
      );
    }

    const latestVersion = await (this.prisma as any).aiPromptVersion.findFirst({
      where: dto.agentSlug ? { agentSlug: dto.agentSlug } : {},
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNum = (latestVersion?.versionNumber || 0) + 1;

    const created = await (this.prisma as any).aiPromptVersion.create({
      data: {
        versionNumber: nextVersionNum,
        name: dto.name.trim(),
        systemPrompt: dto.systemPrompt,
        agentSlug: dto.agentSlug || 'guider',
        sections: dto.sections || null,
        variables: dto.variables || null,
        status: 'DRAFT',
        changeNote: dto.changeNote?.trim() || `Draft v${nextVersionNum}`,
        createdById: dto.userId || null,
      },
    });

    return created;
  }

  /**
   * Update prompt version
   */
  async updatePromptVersion(
    id: string,
    dto: {
      name?: string;
      systemPrompt?: string;
      changeNote?: string;
      sections?: PromptTemplateSections;
      variables?: Record<string, string>;
      status?: string;
    },
    userId?: string,
  ) {
    const existing = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Prompt version '${id}' not found.`);
    }

    return (this.prisma as any).aiPromptVersion.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        systemPrompt: dto.systemPrompt ?? existing.systemPrompt,
        changeNote: dto.changeNote ?? existing.changeNote,
        sections: dto.sections ?? existing.sections,
        variables: dto.variables ?? existing.variables,
        status: dto.status ?? existing.status,
      },
    });
  }

  /**
   * Publish a prompt version: marks it PUBLISHED, updates related Agent's active prompt,
   * and sets previous published versions to ARCHIVED.
   */
  async publishPromptVersion(id: string, userId?: string) {
    const target = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!target) {
      throw new NotFoundException(`Prompt version '${id}' not found.`);
    }

    const agentSlug = target.agentSlug || 'guider';

    // Archive currently published versions for this agent
    await (this.prisma as any).aiPromptVersion.updateMany({
      where: {
        agentSlug,
        status: 'PUBLISHED',
        id: { not: id },
      },
      data: { status: 'ARCHIVED' },
    });

    // Mark target as PUBLISHED
    const published = await (this.prisma as any).aiPromptVersion.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: userId || null,
      },
    });

    // Update Agent's active prompt
    await (this.prisma as any).aiAgent.updateMany({
      where: { slug: agentSlug },
      data: {
        systemPrompt: target.systemPrompt,
        activePromptVersionId: target.id,
      },
    });

    // Update global aiConfig systemInstructions if this is the default guider agent
    if (agentSlug === 'guider') {
      const config = await (this.prisma as any).aiConfig.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (config) {
        await (this.prisma as any).aiConfig.update({
          where: { id: config.id },
          data: { systemInstructions: target.systemPrompt },
        });
      }
    }

    return published;
  }

  /**
   * Rollback to a specific previous prompt version
   */
  async rollbackPromptVersion(id: string, userId?: string) {
    return this.publishPromptVersion(id, userId);
  }

  /**
   * Delete prompt version
   */
  async deletePromptVersion(id: string) {
    const target = await (this.prisma as any).aiPromptVersion.findUnique({
      where: { id },
    });
    if (!target) {
      throw new NotFoundException(`Prompt version '${id}' not found.`);
    }

    if (target.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Cannot delete an actively published prompt version. Publish another version first.',
      );
    }

    await (this.prisma as any).aiPromptVersion.delete({ where: { id } });
    return { success: true, id };
  }
}
