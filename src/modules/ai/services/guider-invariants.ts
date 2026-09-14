import { Logger } from '@nestjs/common';
import {
  GuiderResponseType,
  StructuredTripProposal,
  GuiderOrchestratorResponse,
} from './chat-orchestrator.service';
import {
  GroundedTourRecommendation,
  GroundedDestinationRecommendation,
  StructuredTourComparison,
} from './tour-catalog-tool.service';

/**
 * Authoritative Response Invariant Enforcement System
 * Guarantees schema purity, prevents catalog dumping on text queries,
 * repairs empty recommendations gracefully, and eliminates false booking certainty.
 */
export class ResponseInvariantNormalizer {
  private static readonly logger = new Logger(ResponseInvariantNormalizer.name);

  /**
   * Enforces strict invariants and repairs contract discrepancies
   */
  public static normalizeAndValidate(
    response: GuiderOrchestratorResponse,
    locale: string = 'en',
  ): GuiderOrchestratorResponse {
    const isArabic = (locale || '').startsWith('ar');
    let { responseType, intent, message, recommendations, leadCapture, actions } = response;

    let tours = Array.isArray(recommendations?.tours) ? [...recommendations.tours] : [];
    let proposal: StructuredTripProposal | null = recommendations?.proposal || null;
    let comparison: StructuredTourComparison | null = recommendations?.comparison || null;
    let destinations = Array.isArray(recommendations?.destinations) ? [...recommendations.destinations] : [];

    // Deduplicate tours by ID or slug
    const seenTourIds = new Set<string>();
    const seenTourSlugs = new Set<string>();
    tours = tours.filter((t) => {
      if (t.id && seenTourIds.has(t.id)) return false;
      if (t.slug && seenTourSlugs.has(t.slug)) return false;
      if (t.id) seenTourIds.add(t.id);
      if (t.slug) seenTourSlugs.add(t.slug);
      return true;
    });

    // Invariant 1: Pure TEXT / Informational / Greeting Queries MUST NOT have tours, proposals, or comparisons
    if (responseType === 'text' || intent === 'greeting' || intent === 'casual' || intent === 'informational') {
      responseType = 'text';
      tours = [];
      proposal = null;
      comparison = null;
      if (leadCapture) {
        // Lead capture is only allowed on text if traveler explicitly asked for a private quote
        if (intent !== 'lead_inquiry') {
          leadCapture.required = false;
        }
      }
    }

    // Invariant 2: RECOMMENDATION MUST contain at least 1 valid grounded tour
    else if (responseType === 'recommendation') {
      if (tours.length === 0) {
        this.logger.warn(`Invariant violation: responseType is 'recommendation' but 0 tours matched. Auto-repairing to 'text'.`);
        responseType = 'text';
        intent = 'no_catalog_matches';

        // Graceful repair message if content claimed tours were attached
        const noMatchNotice = isArabic
          ? '\n\n(ملاحظة: لم نجد حالياً باقة في الكتالوج تطابق هذه المعايير بدقة، ولكن يسعدنا تصميم برنامج مخصص لك بالكامل عبر خيار "تصميم رحلة مخصصة").'
          : '\n\n(Note: We currently have no catalog packages exactly matching these criteria. However, our concierge can curate a bespoke tailor-made itinerary for you).';

        if (message && message.content && !message.content.includes(noMatchNotice.trim())) {
          message.content += noMatchNotice;
        }
      }
      // Recommendation must not leak proposals or comparisons
      proposal = null;
      comparison = null;
    }

    // Invariant 3: ITINERARY MUST have a valid StructuredTripProposal with days
    else if (responseType === 'itinerary') {
      if (!proposal || !Array.isArray(proposal.days) || proposal.days.length === 0) {
        this.logger.warn(`Invariant violation: responseType is 'itinerary' but proposal is missing or empty. Auto-repairing.`);
        if (tours.length > 0) {
          responseType = 'recommendation';
          intent = 'tour_recommendation';
        } else {
          responseType = 'text';
          intent = 'informational';
        }
        proposal = null;
      }
      comparison = null;
    }

    // Invariant 4: COMPARISON MUST have a valid StructuredTourComparison with at least 2 tours
    else if (responseType === 'comparison') {
      if (!comparison || !Array.isArray(comparison.tours) || comparison.tours.length < 2) {
        this.logger.warn(`Invariant violation: responseType is 'comparison' but fewer than 2 tours provided. Auto-repairing.`);
        if (tours.length > 0) {
          responseType = 'recommendation';
          intent = 'tour_recommendation';
        } else {
          responseType = 'text';
          intent = 'informational';
        }
        comparison = null;
      }
      proposal = null;
    }

    // Invariant 5: BOOKING_INTENT MUST NEVER claim reservation confirmed
    else if (responseType === 'booking_intent') {
      // Must not leak proposals or comparisons
      proposal = null;
      comparison = null;
      // Guarantee booking intent text directs to official tour page or concierge
      const falseConfirmationRegex = /(تم\s+تأكيد\s+حجزك|تم\s+الحجز\s+بنجاح|your\s+booking\s+(is|has\s+been)\s+confirmed)/i;
      if (message && falseConfirmationRegex.test(message.content)) {
        this.logger.warn(`Invariant violation: GuideR claimed booking confirmed in booking_intent. Sanitizing.`);
        message.content = isArabic
          ? 'يسعدنا اهتمامك بالحجز! يمكنك استعراض تفاصيل الرحلة وتحديد تواريخ السفر بدقة عبر صفحة الرحلة الرسمية أدناه، أو التواصل معنا لإتمام الترتيبات الخاصة.'
          : 'Thank you for your interest! You can review the itinerary and select your travel dates directly on the official tour page below, or connect with our concierge team.';
      }
    }

    // Invariant 6: LEAD_CAPTURE MUST require form
    else if (responseType === 'lead_capture') {
      if (!leadCapture) {
        leadCapture = { required: true, fields: ['name', 'email', 'phone'] };
      } else {
        leadCapture.required = true;
      }
    }

    // Re-synchronize structuredContent payload
    const structuredContent: any = {
      responseType,
      intent,
      type: responseType === 'itinerary' && proposal
        ? 'itinerary_proposal'
        : (responseType === 'comparison' && comparison ? 'tour_comparison' : responseType),
      tours,
      destinations,
    };

    if (proposal) structuredContent.proposal = proposal;
    if (comparison) structuredContent.comparison = comparison;
    if (response.message?.structuredContent?.destinationSummary) {
      structuredContent.destinationSummary = response.message.structuredContent.destinationSummary;
    }

    if (message) {
      message.structuredContent = structuredContent;
    }

    return {
      ...response,
      responseType,
      intent,
      message,
      recommendations: {
        tours,
        destinations,
        proposal,
        comparison,
      },
      leadCapture,
      actions: actions || [],
    };
  }
}
