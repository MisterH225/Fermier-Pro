import { ProducerScore } from "@prisma/client";

export type ProducerScorePillars = {
  dataRegularity: number;
  platformUsage: number;
  responsiveness: number;
};

export function scoreFromActiveDays(activeDays: number, targetDays = 20): number {
  if (activeDays >= targetDays) return 100;
  if (activeDays >= 15) return 90;
  if (activeDays >= 10) return 75;
  if (activeDays >= 7) return 60;
  if (activeDays >= 4) return 45;
  if (activeDays >= 2) return 30;
  if (activeDays >= 1) return 15;
  return 5;
}

export function scoreResponsiveness(input: {
  offersReceived: number;
  offersRespondedWithin48h: number;
  creditBalancesOnTime: number;
  creditBalancesTotal: number;
  chatBuyerMessages: number;
  chatRepliedWithin24h: number;
  reputationScore: number;
}): number {
  let offerComponent = 70;
  if (input.offersReceived > 0) {
    offerComponent = Math.round(
      (input.offersRespondedWithin48h / input.offersReceived) * 100
    );
  }

  let creditComponent = 70;
  if (input.creditBalancesTotal > 0) {
    creditComponent = Math.round(
      (input.creditBalancesOnTime / input.creditBalancesTotal) * 100
    );
  }

  let chatComponent = 70;
  if (input.chatBuyerMessages > 0) {
    chatComponent = Math.round(
      (input.chatRepliedWithin24h / input.chatBuyerMessages) * 100
    );
  }

  const reputationComponent = Math.min(100, Math.max(0, input.reputationScore));

  return Math.round(
    offerComponent * 0.35 +
      creditComponent * 0.2 +
      chatComponent * 0.15 +
      reputationComponent * 0.3
  );
}

export type ProducerCreditEligibility = {
  allowed: boolean;
  limited: boolean;
  reason: string | null;
};

export function evaluateProducerCreditEligibility(input: {
  creditBlocked: boolean;
  producerScore: ProducerScore;
}): ProducerCreditEligibility {
  if (input.creditBlocked) {
    return {
      allowed: false,
      limited: false,
      reason: "blocked_by_admin"
    };
  }
  if (input.producerScore === ProducerScore.risque) {
    return {
      allowed: false,
      limited: false,
      reason: "score_risque"
    };
  }
  if (
    input.producerScore === ProducerScore.attention ||
    input.producerScore === ProducerScore.nouveau
  ) {
    return {
      allowed: true,
      limited: true,
      reason:
        input.producerScore === ProducerScore.nouveau
          ? "score_nouveau"
          : "score_attention"
    };
  }
  return { allowed: true, limited: false, reason: null };
}

export function deriveProducerScore(
  pillars: ProducerScorePillars,
  isNew: boolean
): ProducerScore {
  if (isNew) {
    return ProducerScore.nouveau;
  }

  const global = Math.round(
    pillars.dataRegularity * 0.35 +
      pillars.platformUsage * 0.25 +
      pillars.responsiveness * 0.4
  );

  if (global >= 85 && pillars.responsiveness >= 80 && pillars.dataRegularity >= 70) {
    return ProducerScore.excellent;
  }
  if (global < 35 || pillars.responsiveness < 25) {
    return ProducerScore.risque;
  }
  if (global < 50 || pillars.responsiveness < 45 || pillars.dataRegularity < 25) {
    return ProducerScore.attention;
  }
  if (global >= 55) {
    return ProducerScore.bon;
  }
  return ProducerScore.attention;
}

export function globalProducerScoreValue(pillars: ProducerScorePillars): number {
  return Math.round(
    pillars.dataRegularity * 0.35 +
      pillars.platformUsage * 0.25 +
      pillars.responsiveness * 0.4
  );
}
