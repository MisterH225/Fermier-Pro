import type { FeedIngredientCategory } from "@prisma/client";

/**
 * Prix de référence (XOF/kg) pour formulation « théorique » sans moulin.
 * Ordres de grandeur marché CI — pas un devis.
 */
export const REFERENCE_PRICE_PER_KG: Record<FeedIngredientCategory, number> = {
  cereal: 250,
  plant_protein: 450,
  animal_protein: 800,
  byproduct: 180,
  mineral: 200,
  additive: 2500
};

/** Stock théorique illimité pour le catalogue (kg). */
export const THEORETICAL_MAX_AVAILABLE_KG = 100_000;
