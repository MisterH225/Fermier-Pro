/** Catégories cheptel utilisées dans les KPI / graphiques. */
export type CheptelBatchCategorySlot =
  | "reproducteur_femelle"
  | "reproducteur_male"
  | "fattening"
  | "starter"
  | "growth"
  | "other";

/** Tag bande pour loges / détection (démarrage vs engraissement). */
export type BatchTypeTag = "starter" | "fattening";

/**
 * Classe une bande selon son `categoryKey` Prisma.
 * Reconnaît les valeurs exactes `starter` / `fattening` (bandes confirmées, onboarding).
 */
export function mapBatchCategoryKey(
  key: string | null | undefined
): CheptelBatchCategorySlot {
  const k = (key ?? "").toLowerCase();
  if (
    k.includes("truie") ||
    k.includes("sow") ||
    (k.includes("breed") && k.includes("fem"))
  ) {
    return "reproducteur_femelle";
  }
  if (
    k.includes("verrat") ||
    k.includes("boar") ||
    (k.includes("breed") && k.includes("male"))
  ) {
    return "reproducteur_male";
  }
  if (
    k.includes("nursery") ||
    k.includes("porcelet") ||
    k.includes("demarrage") ||
    k === "starter" ||
    k === "start"
  ) {
    return "starter";
  }
  if (k.includes("grow") || k.includes("croissance") || k === "grower") {
    return "growth";
  }
  if (
    k === "fattening" ||
    k.includes("finish") ||
    k.includes("engrais") ||
    k === "finisher"
  ) {
    return "fattening";
  }
  if (k.includes("breed") || k.includes("reprod")) {
    return "reproducteur_femelle";
  }
  return "other";
}

export function mapBatchTypeTag(
  key: string | null | undefined
): BatchTypeTag | null {
  const slot = mapBatchCategoryKey(key);
  if (slot === "starter" || slot === "growth") {
    return "starter";
  }
  if (slot === "fattening") {
    return "fattening";
  }
  return null;
}
