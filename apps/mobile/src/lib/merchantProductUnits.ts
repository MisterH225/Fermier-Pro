/** Unités de vente suggérées (l’utilisateur peut aussi saisir une unité libre). */
export const MERCHANT_PRODUCT_UNIT_PRESETS = [
  "kg",
  "g",
  "L",
  "unité",
  "pièce",
  "douzaine",
  "sac",
  "botte"
] as const;

export type MerchantProductUnitPreset =
  (typeof MERCHANT_PRODUCT_UNIT_PRESETS)[number];

export function isPresetUnit(value: string): boolean {
  const v = value.trim().toLowerCase();
  return MERCHANT_PRODUCT_UNIT_PRESETS.some((p) => p.toLowerCase() === v);
}
