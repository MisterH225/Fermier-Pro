import type { TrustScoreProfileType } from "@prisma/client";

/** Version de formule — incrémenter à chaque changement de poids/signaux. */
export const TRUST_SCORE_VERSION = 2;

/**
 * Flag runtime : tant que false, mobile + crédit consomment le score producteur v1.
 * La bascule crédit est volontairement hors périmètre de ce module.
 */
export function isTrustScoreV2Active(): boolean {
  const raw = (process.env.TRUST_SCORE_V2_ACTIVE ?? "false").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Fenêtre glissante des signaux comportementaux (avis exclus — cumul bayésien). */
export const TRUST_SCORE_BEHAVIOR_WINDOW_DAYS = 90;

/** Prior bayésien pour les avis (échelle 1–5). */
export const BAYESIAN_PRIOR_MEAN = 3.5;
export const BAYESIAN_PRIOR_STRENGTH = 5;

/**
 * Seuil "nouvelle" : < N transactions pertinentes ET compte < MAX_AGE_DAYS.
 * Jamais un mauvais score par simple absence de données.
 */
export const NEW_PROFILE_MAX_AGE_DAYS = 30;
export const NEW_PROFILE_MIN_TRANSACTIONS = 3;

/**
 * Poids des piliers par profil — ajustables.
 * Un pilier sans données a son poids redistribué (voir redistributeWeights).
 */
export const TRUST_PILLAR_WEIGHTS = {
  producer: {
    /** Régularité de saisie — réutilise ProducerScoreMetricsService. */
    dataRegularity: 0.3,
    /** Réactivité offres / crédit / chat — réutilise ProducerScoreMetricsService. */
    responsiveness: 0.3,
    /**
     * Confiance commerciale : avis FarmMarketRating (bayésien) +
     * escrow sans litige perdu + annulations vendeur + poids validés sans contre-déclaration.
     * User.reputationScore est EXCLU (pénalités d'annulation déjà dans ce pilier).
     */
    commercialTrust: 0.4
  },
  buyer: {
    paymentReliability: 0.3,
    receiptTimeliness: 0.25,
    disputeRecord: 0.25,
    cancellationRate: 0.2
    // Pas d'avis acheteur en base (BuyerProfile.ratingAvg non alimenté) — omis.
  },
  merchant: {
    orderFulfillment: 0.4,
    confirmationSpeed: 0.25,
    disputeRecord: 0.35
    // Pas de modèle d'avis boutique (MerchantProductRating inexistant) — omis.
  },
  vet: {
    ratings: 0.45,
    appointmentHonor: 0.35,
    requestReactivity: 0.2
  },
  technician: {
    followUpActivity: 0.6,
    regularity: 0.4
  }
} as const satisfies Record<
  TrustScoreProfileType,
  Record<string, number>
>;

export type TrustPillarKey =
  | keyof typeof TRUST_PILLAR_WEIGHTS.producer
  | keyof typeof TRUST_PILLAR_WEIGHTS.buyer
  | keyof typeof TRUST_PILLAR_WEIGHTS.merchant
  | keyof typeof TRUST_PILLAR_WEIGHTS.vet
  | keyof typeof TRUST_PILLAR_WEIGHTS.technician;

/** Clés i18n de conseil d'amélioration par pilier. */
export const TRUST_PILLAR_HINT_KEYS: Record<string, string> = {
  dataRegularity: "trustScore.hints.dataRegularity",
  responsiveness: "trustScore.hints.responsiveness",
  commercialTrust: "trustScore.hints.commercialTrust",
  paymentReliability: "trustScore.hints.paymentReliability",
  receiptTimeliness: "trustScore.hints.receiptTimeliness",
  disputeRecord: "trustScore.hints.disputeRecord",
  cancellationRate: "trustScore.hints.cancellationRate",
  orderFulfillment: "trustScore.hints.orderFulfillment",
  confirmationSpeed: "trustScore.hints.confirmationSpeed",
  ratings: "trustScore.hints.ratings",
  appointmentHonor: "trustScore.hints.appointmentHonor",
  requestReactivity: "trustScore.hints.requestReactivity",
  followUpActivity: "trustScore.hints.followUpActivity",
  regularity: "trustScore.hints.regularity"
};

/** Seuils de niveau météo (hors état "nouvelle"). */
export const TRUST_LEVEL_THRESHOLDS = {
  ensoleille: 75,
  eclaircies: 55,
  nuageux: 35
  // < 35 → orageux
} as const;
