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

  const reputationComponent = Math.min(100, Math.max(0, input.reputationScore));

  return Math.round(
    offerComponent * 0.45 + creditComponent * 0.25 + reputationComponent * 0.3
  );
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
  if (global >= 65) {
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
