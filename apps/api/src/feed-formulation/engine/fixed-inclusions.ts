/**
 * Taux d'incorporation fixes (prémélanges) — hors optimisation LP.
 * Format stocké : [{ feedIngredientId, inclusionPct }] (inclusionPct en % de la masse).
 */

export type FixedInclusion = {
  feedIngredientId: string;
  inclusionPct: number;
};

/** Seuil d'avertissement admin (probable erreur de saisie) — n'bloque pas. */
export const FIXED_INCLUSIONS_WARN_THRESHOLD_PCT = 5;

export function parseFixedInclusions(raw: unknown): FixedInclusion[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: FixedInclusion[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const id = String(
      (item as { feedIngredientId?: unknown }).feedIngredientId ?? ""
    ).trim();
    const pct = Number((item as { inclusionPct?: unknown }).inclusionPct);
    if (!id || !Number.isFinite(pct) || pct <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ feedIngredientId: id, inclusionPct: pct });
  }
  return out;
}

export function sumFixedInclusionPct(items: FixedInclusion[]): number {
  return items.reduce((s, i) => s + i.inclusionPct, 0);
}
