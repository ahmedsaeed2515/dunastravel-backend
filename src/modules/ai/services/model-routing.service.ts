import { Injectable, Logger } from '@nestjs/common';
import { PROVIDER_REGISTRY, MODEL_REGISTRY } from './model-registry.service';

// ============================================================
// MODEL ROUTING POLICY ENGINE
// Implements tiered routing: Economy → Normal → Complex → Fallback
// Classification is deterministic-first, no expensive LLM needed.
// ============================================================

export type RoutingTier = 'economy' | 'normal' | 'complex' | 'fallback';

export interface RoutingPolicy {
  tier: RoutingTier;
  provider: string;
  model: string;
  reason: string;
}

export interface AgentModelPolicy {
  agentSlug: string;
  economy: { provider: string; model: string };
  normal: { provider: string; model: string };
  complex: { provider: string; model: string };
  fallback: { provider: string; model: string };
}

// ============================================================
// DEFAULT ROUTING TABLE
// Edit here when models change — no code changes elsewhere needed.
// ============================================================

export const DEFAULT_ROUTING_TABLE: Record<RoutingTier, { provider: string; model: string }> = {
  economy: {
    provider: 'google',
    model: 'gemini-3.1-flash-lite',
  },
  normal: {
    provider: 'google',
    model: 'gemini-3.7-flash',
  },
  complex: {
    provider: 'google',
    model: 'gemini-3.1-pro',
  },
  fallback: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat-v3-0324',
  },
};

// ============================================================
// PER-AGENT POLICIES
// Agents can override the default routing table.
// ============================================================

export const AGENT_ROUTING_POLICIES: AgentModelPolicy[] = [
  {
    agentSlug: 'guider',
    economy: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    normal: { provider: 'google', model: 'gemini-3.5-flash' },
    complex: { provider: 'google', model: 'gemini-3.5-flash' },
    fallback: { provider: 'google', model: 'gemini-2.5-flash' },
  },
  {
    agentSlug: 'booking-specialist',
    economy: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    normal: { provider: 'google', model: 'gemini-3.5-flash' },
    complex: { provider: 'google', model: 'gemini-3.5-flash' },
    fallback: { provider: 'google', model: 'gemini-2.5-flash' },
  },
  {
    agentSlug: 'support',
    economy: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    normal: { provider: 'google', model: 'gemini-3.5-flash' },
    complex: { provider: 'google', model: 'gemini-3.5-flash' },
    fallback: { provider: 'google', model: 'gemini-2.5-flash' },
  },
];

// ============================================================
// CLASSIFICATION SIGNALS
// ============================================================

// Keywords that indicate a simple FAQ / policy question → economy
const ECONOMY_SIGNALS = [
  'what is', 'how much', 'price', 'cost', 'when', 'where', 'visa', 'policy',
  'refund', 'cancel', 'payment', 'hours', 'open', 'close', 'available',
  'hello', 'hi', 'مرحبا', 'كم', 'متى', 'أين', 'سعر', 'تأشيرة',
];

// Keywords that indicate a complex itinerary / multi-step task → complex
const COMPLEX_SIGNALS = [
  'itinerary', 'plan my', 'multi-day', 'customize', 'combine', 'route',
  'compare', 'budget for', 'book multiple', 'family of', 'group of',
  'private tour', 'honeymoon', 'anniversary', 'special occasion',
  'خطة رحلة', 'برنامج سياحي', 'رحلة مخصصة', 'مجموعة', 'عائلة',
];

// Structural signals: long messages, many sentences, tool requests → complex
const COMPLEX_STRUCTURAL_THRESHOLD = 200; // chars
const COMPLEX_SENTENCE_THRESHOLD = 4;

@Injectable()
export class ModelRoutingService {
  private readonly logger = new Logger(ModelRoutingService.name);

  /**
   * Classify a request into a routing tier.
   * Uses deterministic signals only — no LLM cost for classification.
   */
  classifyRequest(
    message: string,
    context?: {
      toolsRequired?: string[];
      conversationLength?: number;
      agentSlug?: string;
    },
  ): { tier: RoutingTier; reason: string } {
    const msg = message.toLowerCase().trim();

    // Complex structural signals
    if (message.length > COMPLEX_STRUCTURAL_THRESHOLD) {
      const sentences = message.split(/[.!?،؟]/).filter(Boolean).length;
      if (sentences >= COMPLEX_SENTENCE_THRESHOLD) {
        return { tier: 'complex', reason: `Long message with ${sentences} sentences and ${message.length} chars` };
      }
    }

    // Complex keyword signals
    for (const signal of COMPLEX_SIGNALS) {
      if (msg.includes(signal)) {
        return { tier: 'complex', reason: `Complex keyword: "${signal}"` };
      }
    }

    // Tool requirements force complex
    if (context?.toolsRequired && context.toolsRequired.length > 2) {
      return { tier: 'complex', reason: `Requires ${context.toolsRequired.length} tools` };
    }

    // Economy keyword signals
    for (const signal of ECONOMY_SIGNALS) {
      if (msg.includes(signal)) {
        return { tier: 'economy', reason: `Economy keyword: "${signal}"` };
      }
    }

    // Short messages default to economy
    if (message.length < 60) {
      return { tier: 'economy', reason: `Short message (${message.length} chars)` };
    }

    // Default: normal tier
    return { tier: 'normal', reason: 'Standard concierge conversation' };
  }

  /**
   * Resolve which provider and model to use for a given tier and agent.
   */
  resolveModel(
    tier: RoutingTier,
    agentSlug?: string,
  ): { provider: string; model: string; tier: RoutingTier } {
    if (agentSlug) {
      const policy = AGENT_ROUTING_POLICIES.find((p) => p.agentSlug === agentSlug);
      if (policy) {
        const assignment = policy[tier];
        this.logger.debug(`Routing [${agentSlug}/${tier}] → ${assignment.provider}/${assignment.model}`);
        return { ...assignment, tier };
      }
    }

    const assignment = DEFAULT_ROUTING_TABLE[tier];
    this.logger.debug(`Routing [default/${tier}] → ${assignment.provider}/${assignment.model}`);
    return { ...assignment, tier };
  }

  /**
   * Convenience: classify and resolve in one call.
   */
  route(
    message: string,
    agentSlug?: string,
    context?: { toolsRequired?: string[]; conversationLength?: number },
  ): RoutingPolicy {
    const { tier, reason } = this.classifyRequest(message, { ...context, agentSlug });
    const { provider, model } = this.resolveModel(tier, agentSlug);
    return { tier, provider, model, reason };
  }

  /**
   * Get the full routing table for display in the UI.
   */
  getRoutingTable(): Record<RoutingTier, { provider: string; model: string; displayName?: string }> {
    const result: any = {};
    for (const [tier, config] of Object.entries(DEFAULT_ROUTING_TABLE)) {
      const modelDef = MODEL_REGISTRY[config.model];
      result[tier] = {
        ...config,
        displayName: modelDef?.displayName,
        providerDisplayName: PROVIDER_REGISTRY[config.provider]?.displayName,
      };
    }
    return result;
  }

  /**
   * Get per-agent routing policies for UI display.
   */
  getAgentPolicies(): AgentModelPolicy[] {
    return AGENT_ROUTING_POLICIES;
  }
}
