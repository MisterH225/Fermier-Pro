import type { BuyerProfileCompletionInput } from "./buyerProfileCompletion";

/** Construit un profil synthétique pour la jauge (même module que la page Compte). */
export function buyerProfileFromOnboarding(input: {
  buyerType: string;
  preferredCategories: string[];
  typicalVolume: string;
  locationLabel: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
  searchRadiusKm: number | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
}): BuyerProfileCompletionInput {
  return {
    buyerType: input.buyerType,
    businessName: null,
    preferredCategories: input.preferredCategories,
    priceRangeMin:
      input.priceRangeMin != null ? String(input.priceRangeMin) : null,
    priceRangeMax:
      input.priceRangeMax != null ? String(input.priceRangeMax) : null,
    locationLabel: input.locationLabel.trim() || null,
    homeLatitude: input.homeLatitude,
    homeLongitude: input.homeLongitude,
    searchRadiusKm: input.searchRadiusKm,
    typicalVolume: input.typicalVolume || null,
    profilePhotoUrl: null
  };
}
