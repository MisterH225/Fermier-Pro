/** Catégories cheptel utilisées dans les KPI / graphiques. */
export type CheptelBatchCategorySlot =
  | "reproducteur_femelle"
  | "reproducteur_male"
  | "sous_mere"
  | "fattening"
  | "starter"
  | "growth"
  | "other";

/** Tag bande pour loges / détection (lactation, démarrage, engraissement). */
export type BatchTypeTag = "sous_mere" | "starter" | "fattening";

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
    k.includes("sous_mere") ||
    k.includes("sous-mere") ||
    k.includes("lactation") ||
    k.includes("allaitement") ||
    k.includes("nursing")
  ) {
    return "sous_mere";
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
  if (slot === "sous_mere") {
    return "sous_mere";
  }
  if (slot === "starter" || slot === "growth") {
    return "starter";
  }
  if (slot === "fattening") {
    return "fattening";
  }
  return null;
}
