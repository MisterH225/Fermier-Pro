import { TrustScoreLevel } from "@prisma/client";
import {
  BAYESIAN_PRIOR_MEAN,
  BAYESIAN_PRIOR_STRENGTH,
  NEW_PROFILE_MAX_AGE_DAYS,
  NEW_PROFILE_MIN_TRANSACTIONS,
  TRUST_LEVEL_THRESHOLDS,
  TRUST_PILLAR_HINT_KEYS
} from "./trust-score.constants";

export type PillarInput = {
  key: string;
  /** Score 0–100 ; null = pas de données exploitables. */
  score: number | null;
  weight: number;
  sampleSize: number;
  hasData: boolean;
};

export type PillarView = {
  key: string;
  score: number;
  weight: number;
  sampleSize: number;
  hintKey: string;
};

export type AggregatedTrustScore = {
  score: number;
  level: TrustScoreLevel;
  pillars: PillarView[];
  isNew: boolean;
  sampleSizes: Record<string, number>;
};

const MS_PER_DAY = 86_400_000;

/**
 * Moyenne bayésienne des avis (échelle 1–5) :
 * (C×m + Σnotes) ÷ (C + n) avec m=3.5, C=5.
 * Un profil à 2 avis 5★ ne peut pas être extrême.
 * Retourne un score 0–100 (moyenne × 20).
 */
export function bayesianRatingScore(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  const avg =
    (BAYESIAN_PRIOR_STRENGTH * BAYESIAN_PRIOR_MEAN + sum) /
    (BAYESIAN_PRIOR_STRENGTH + ratings.length);
  return clampScore(avg * 20);
}

/**
 * Règle de redistribution des poids (OBLIGATOIRE) :
 * Un pilier sans données exploitables (hasData === false) est exclu.
 * Son poids est redistribué proportionnellement aux piliers restants.
 * Si aucun pilier n'a de données → score neutre 50 (puis niveau "nouvelle" si applicable).
 */
export function redistributeWeights(pillars: PillarInput[]): {
  active: Array<PillarInput & { effectiveWeight: number }>;
  totalActiveWeight: number;
} {
  const active = pillars.filter((p) => p.hasData && p.score != null);
  const totalActiveWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalActiveWeight <= 0) {
    return { active: [], totalActiveWeight: 0 };
  }
  return {
    active: active.map((p) => ({
      ...p,
      effectiveWeight: p.weight / totalActiveWeight
    })),
    totalActiveWeight
  };
}

export function aggregatePillars(
  pillars: PillarInput[],
  opts: { userCreatedAt: Date; transactionCount: number; now?: Date }
): AggregatedTrustScore {
  const now = opts.now ?? new Date();
  const accountAgeDays =
    (now.getTime() - opts.userCreatedAt.getTime()) / MS_PER_DAY;
  const isNew =
    accountAgeDays < NEW_PROFILE_MAX_AGE_DAYS &&
    opts.transactionCount < NEW_PROFILE_MIN_TRANSACTIONS;

  const { active } = redistributeWeights(pillars);
  const sampleSizes: Record<string, number> = {};
  for (const p of pillars) {
    sampleSizes[p.key] = p.sampleSize;
  }
  sampleSizes.transactionCount = opts.transactionCount;
  sampleSizes.accountAgeDays = Math.floor(accountAgeDays);

  if (isNew) {
    const pillarViews = pillars.map((p) => toPillarView(p, p.weight));
    return {
      score: 50,
      level: TrustScoreLevel.nouvelle,
      pillars: pillarViews,
      isNew: true,
      sampleSizes
    };
  }

  if (active.length === 0) {
    // Pas assez de signaux mais compte trop âgé pour "nouvelle" → neutre nuageux.
    return {
      score: 50,
      level: TrustScoreLevel.nuageux,
      pillars: pillars.map((p) => toPillarView(p, p.weight)),
      isNew: false,
      sampleSizes
    };
  }

  let global = 0;
  for (const p of active) {
    global += (p.score as number) * p.effectiveWeight;
  }
  const score = clampScore(Math.round(global));
  const weightByKey = new Map(
    active.map((p) => [p.key, p.effectiveWeight] as const)
  );

  return {
    score,
    level: levelFromScore(score, false),
    pillars: pillars.map((p) =>
      toPillarView(p, weightByKey.get(p.key) ?? 0)
    ),
    isNew: false,
    sampleSizes
  };
}

export function levelFromScore(
  score: number,
  isNew: boolean
): TrustScoreLevel {
  if (isNew) return TrustScoreLevel.nouvelle;
  if (score >= TRUST_LEVEL_THRESHOLDS.ensoleille) {
    return TrustScoreLevel.ensoleille;
  }
  if (score >= TRUST_LEVEL_THRESHOLDS.eclaircies) {
    return TrustScoreLevel.eclaircies;
  }
  if (score >= TRUST_LEVEL_THRESHOLDS.nuageux) {
    return TrustScoreLevel.nuageux;
  }
  return TrustScoreLevel.orageux;
}

/** Taux de succès → score 0–100 ; null si dénominateur nul (poids redistribué). */
export function rateToScore(
  success: number,
  total: number
): { score: number | null; hasData: boolean } {
  if (total <= 0) return { score: null, hasData: false };
  return {
    score: clampScore(Math.round((success / total) * 100)),
    hasData: true
  };
}

/** Inverse un taux d'échec (plus bas = mieux). */
export function failureRateToScore(
  failures: number,
  total: number
): { score: number | null; hasData: boolean } {
  if (total <= 0) return { score: null, hasData: false };
  const ok = Math.max(0, total - failures);
  return rateToScore(ok, total);
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Clé de journée UTC pour l'idempotence des snapshots. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfUtcDay(d: Date): Date {
  return new Date(`${utcDayKey(d)}T00:00:00.000Z`);
}

export function endOfUtcDay(d: Date): Date {
  return new Date(`${utcDayKey(d)}T23:59:59.999Z`);
}

/** Mappe un ProducerScore v1 vers un niveau TrustScore v2 (rapport ombre). */
export function mapProducerScoreV1ToLevel(
  score: string
): TrustScoreLevel {
  switch (score) {
    case "excellent":
      return TrustScoreLevel.ensoleille;
    case "bon":
      return TrustScoreLevel.eclaircies;
    case "nouveau":
      return TrustScoreLevel.nouvelle;
    case "attention":
      return TrustScoreLevel.nuageux;
    case "risque":
      return TrustScoreLevel.orageux;
    default:
      return TrustScoreLevel.nuageux;
  }
}

function toPillarView(p: PillarInput, effectiveWeight: number): PillarView {
  return {
    key: p.key,
    score: p.score ?? 50,
    weight: Math.round(effectiveWeight * 1000) / 1000,
    sampleSize: p.sampleSize,
    hintKey: TRUST_PILLAR_HINT_KEYS[p.key] ?? `trustScore.hints.${p.key}`
  };
}
