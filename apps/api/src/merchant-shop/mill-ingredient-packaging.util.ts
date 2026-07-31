import { MillIngredientPackaging } from "@prisma/client";

/** Facteurs de conversion par défaut (kg par unité de conditionnement). */
export const DEFAULT_UNIT_TO_KG: Record<MillIngredientPackaging, number> = {
  [MillIngredientPackaging.kg]: 1,
  [MillIngredientPackaging.sack_50kg]: 50,
  [MillIngredientPackaging.sack_25kg]: 25,
  /** Densité approximative eau — le moulin peut surcharger via unitToKg. */
  [MillIngredientPackaging.liter]: 1,
  [MillIngredientPackaging.ton]: 1000
};

export function defaultUnitToKg(packaging: MillIngredientPackaging): number {
  return DEFAULT_UNIT_TO_KG[packaging];
}

/** Résout unitToKg : valeur fournie si > 0, sinon défaut packaging. */
export function resolveUnitToKg(
  packaging: MillIngredientPackaging,
  unitToKg?: number | null
): number {
  if (unitToKg != null && Number.isFinite(unitToKg) && unitToKg > 0) {
    return unitToKg;
  }
  return defaultUnitToKg(packaging);
}

/** Libellé FR pour unitLabel du MerchantProduct synchronisé. */
export function packagingUnitLabel(packaging: MillIngredientPackaging): string {
  switch (packaging) {
    case MillIngredientPackaging.kg:
      return "kg";
    case MillIngredientPackaging.sack_50kg:
      return "sac 50 kg";
    case MillIngredientPackaging.sack_25kg:
      return "sac 25 kg";
    case MillIngredientPackaging.liter:
      return "L";
    case MillIngredientPackaging.ton:
      return "tonne";
    default:
      return "kg";
  }
}

/** Prix au kg pour comparaison composition (J4). */
export function pricePerKg(
  pricePerUnit: number,
  unitToKg: number
): number | null {
  if (!Number.isFinite(pricePerUnit) || !Number.isFinite(unitToKg) || unitToKg <= 0) {
    return null;
  }
  return pricePerUnit / unitToKg;
}
