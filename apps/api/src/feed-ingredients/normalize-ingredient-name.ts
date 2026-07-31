/**
 * Normalise un nom d'intrant pour recherche / anti-doublon :
 * minuscules, sans accents, espaces compressés.
 */
export function normalizeIngredientName(
  raw: string | null | undefined
): string {
  if (raw == null) return "";
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si `candidate` correspond au nom canonique ou à un alias (normalisés). */
export function ingredientNameMatches(
  candidate: string,
  canonicalName: string,
  aliases: string[]
): boolean {
  const q = normalizeIngredientName(candidate);
  if (!q) return false;
  if (normalizeIngredientName(canonicalName) === q) return true;
  return aliases.some((a) => normalizeIngredientName(a) === q);
}
