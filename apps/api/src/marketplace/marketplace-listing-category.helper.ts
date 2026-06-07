import {
  ListingMarketCategory,
  PigPriceIndexCategory
} from "@prisma/client";

function indexCategoryFromWeightKg(
  productionCategory: string | null | undefined,
  weightKg: number
): PigPriceIndexCategory | null {
  if (
    productionCategory === "breeding_female" ||
    productionCategory === "breeding_male"
  ) {
    return PigPriceIndexCategory.reproducteur;
  }
  if (weightKg < LISTING_PIGLET_MAX_AVG_KG) {
    return PigPriceIndexCategory.porcelet;
  }
  if (weightKg <= 50) {
    return PigPriceIndexCategory.croissance;
  }
  if (weightKg <= 110) {
    return PigPriceIndexCategory.charcutier;
  }
  return null;
}

/** Poids moyen max. (kg) pour une annonce « porcelet ». */
export const LISTING_PIGLET_MAX_AVG_KG = 15;

/** Porcelets et reproducteurs : prix forfaitaire (pas au kg). */
export function usesFlatListingPrice(
  category: ListingMarketCategory | null | undefined
): boolean {
  return (
    category === ListingMarketCategory.piglet ||
    category === ListingMarketCategory.breeder
  );
}

export function listingHeadcount(
  animalIds: string[],
  animalId: string | null,
  quantity?: number | null
): number {
  if (animalIds.length > 0) {
    return animalIds.length;
  }
  if (animalId) {
    return 1;
  }
  if (quantity != null && quantity > 0) {
    return quantity;
  }
  return 1;
}

export function averageWeightKg(
  totalWeightKg: number,
  headcount: number
): number {
  return totalWeightKg / Math.max(1, headcount);
}

/** `piglet` = classification automatique selon le poids ; les autres = intention vendeur. */
export function isAutoWeightListingCategory(
  category: ListingMarketCategory | null | undefined
): boolean {
  return (
    category == null || category === ListingMarketCategory.piglet
  );
}

/**
 * Catégorie d’annonce persistée : intention vendeur (repro / charcutier / réformée)
 * ou déduction automatique depuis le poids si « porcelet » / non renseigné.
 */
export function resolveListingMarketCategory(
  sellerCategory: ListingMarketCategory | null | undefined,
  totalWeightKg: number | null | undefined,
  headcount: number
): ListingMarketCategory | null {
  if (sellerCategory === ListingMarketCategory.breeder) {
    return ListingMarketCategory.breeder;
  }
  if (sellerCategory === ListingMarketCategory.reformed) {
    return ListingMarketCategory.reformed;
  }
  if (sellerCategory === ListingMarketCategory.butcher) {
    return ListingMarketCategory.butcher;
  }

  if (totalWeightKg == null || totalWeightKg <= 0 || !Number.isFinite(totalWeightKg)) {
    return sellerCategory ?? null;
  }

  const avg = averageWeightKg(totalWeightKg, headcount);
  if (avg < LISTING_PIGLET_MAX_AVG_KG) {
    return ListingMarketCategory.piglet;
  }
  return ListingMarketCategory.butcher;
}

/** Catégorie indice prix à partir d’une annonce (poids + intention). */
export function categoryForPriceIndexFromListing(
  listingCategory: ListingMarketCategory | null,
  totalWeightKg: number | null | undefined,
  headcount: number,
  productionCategory?: string | null
): PigPriceIndexCategory | null {
  if (listingCategory === ListingMarketCategory.breeder) {
    return PigPriceIndexCategory.reproducteur;
  }
  if (listingCategory === ListingMarketCategory.reformed) {
    return PigPriceIndexCategory.charcutier;
  }

  const w =
    totalWeightKg != null && totalWeightKg > 0
      ? averageWeightKg(totalWeightKg, headcount)
      : 0;

  if (w <= 0) {
    if (listingCategory === ListingMarketCategory.piglet) {
      return PigPriceIndexCategory.porcelet;
    }
    if (listingCategory === ListingMarketCategory.butcher) {
      return PigPriceIndexCategory.charcutier;
    }
    return null;
  }

  return indexCategoryFromWeightKg(productionCategory ?? "fattening", w);
}
