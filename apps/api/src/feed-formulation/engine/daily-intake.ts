import type { ProductionStage } from "@prisma/client";

/**
 * Estime l'ingéré journalier (kg/tête) si le profil n'a pas de cible.
 * Ordres de grandeur — source unique côté moteur (pas de calcul hors service).
 */
export function estimateDailyIntakeKg(
  stage: ProductionStage,
  avgWeightKg: number
): number {
  const w = Math.max(1, avgWeightKg);
  switch (stage) {
    case "piglet_weaning":
      return clamp(0.04 * w, 0.25, 0.8);
    case "growing":
      return clamp(0.04 * w, 0.8, 2.2);
    case "fattening":
      return clamp(0.035 * w, 1.8, 3.2);
    case "finishing":
      return clamp(0.03 * w, 2.2, 3.5);
    case "gestating_sow":
      return clamp(0.02 * w, 2.0, 3.2);
    case "lactating_sow":
      return clamp(0.04 * w, 4.5, 8.0);
    default:
      return clamp(0.035 * w, 0.5, 4.0);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function resolveDailyIntakeKg(
  targetDailyIntakeKg: number | null | undefined,
  stage: ProductionStage,
  avgWeightKg: number
): number {
  if (
    targetDailyIntakeKg != null &&
    Number.isFinite(targetDailyIntakeKg) &&
    targetDailyIntakeKg > 0
  ) {
    return targetDailyIntakeKg;
  }
  return estimateDailyIntakeKg(stage, avgWeightKg);
}
