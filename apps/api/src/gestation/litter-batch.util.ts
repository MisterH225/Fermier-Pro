/** Bande issue d'une mise bas (ne pas convertir en animaux individuels). */
export function isGestationLitterBatch(batch: {
  sourceTag?: string | null;
  categoryKey?: string | null;
}): boolean {
  const tag = batch.sourceTag ?? "";
  if (tag.startsWith("gestation:")) {
    return true;
  }
  const cat = (batch.categoryKey ?? "").toLowerCase();
  return cat === "sous_mere";
}
