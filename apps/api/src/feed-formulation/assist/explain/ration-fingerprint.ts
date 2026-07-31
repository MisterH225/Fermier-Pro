import type { NutritionForExplain, RationLineForExplain } from "./composition-explanation.types";

/** Empreinte stable de la ration + nutrition clé — pour le cache. */
export function computeRationFingerprint(
  stage: string,
  ration: RationLineForExplain[],
  nutrition: NutritionForExplain | null
): string {
  const lines = [...ration]
    .map((l) => ({
      id: l.feedIngredientId,
      pct: round4(Number(l.proportionPct) || 0)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const n = nutrition
    ? {
        cp: round4(nutrition.crudeProteinPct),
        me: round4(nutrition.metabolizableEnergyKcal),
        lys: round4(nutrition.lysinePct)
      }
    : null;
  return `${stage}|${JSON.stringify(lines)}|${JSON.stringify(n)}`;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Parse un cache JSON SavedComposition.explanation. */
export function parseCachedExplanation(
  raw: unknown
): { rationFingerprint: string; payload: Record<string, unknown> } | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fp = typeof o.rationFingerprint === "string" ? o.rationFingerprint : null;
  if (!fp) return null;
  return { rationFingerprint: fp, payload: o };
}
