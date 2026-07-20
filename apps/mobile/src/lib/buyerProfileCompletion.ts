/**
 * Source unique de calcul de jauge acheteur.
 * Utilisé par BuyerAccountScreen ET BuyerOnboardingScreen — ne pas dupliquer.
 */
export type BuyerProfileFieldKey =
  | "buyerType"
  | "businessName"
  | "locationLabel"
  | "searchRadiusKm"
  | "preferredCategories"
  | "priceRange"
  | "typicalVolume"
  | "profilePhotoUrl";

/** Champs nécessaires à la jauge (Compte + onboarding). */
export type BuyerProfileCompletionInput = {
  buyerType?: string | null;
  businessName?: string | null;
  locationLabel?: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  searchRadiusKm?: number | null;
  preferredCategories?: string[] | null;
  priceRangeMin?: string | number | null;
  priceRangeMax?: string | number | null;
  typicalVolume?: string | null;
  profilePhotoUrl?: string | null;
};

type FieldCheck = {
  key: BuyerProfileFieldKey;
  filled: boolean;
};

function fieldChecks(profile: BuyerProfileCompletionInput): FieldCheck[] {
  const needsBusiness =
    profile.buyerType === "professional" ||
    profile.buyerType === "slaughterhouse" ||
    profile.buyerType === "wholesaler" ||
    profile.buyerType === "reseller";

  return [
    { key: "buyerType", filled: Boolean(profile.buyerType) },
    {
      key: "businessName",
      filled: !needsBusiness || Boolean(profile.businessName?.trim())
    },
    {
      key: "locationLabel",
      filled:
        Boolean(profile.locationLabel?.trim()) ||
        (profile.homeLatitude != null && profile.homeLongitude != null)
    },
    {
      key: "searchRadiusKm",
      filled: profile.searchRadiusKm != null && profile.searchRadiusKm > 0
    },
    {
      key: "preferredCategories",
      filled: Boolean(profile.preferredCategories?.length)
    },
    {
      key: "priceRange",
      filled: profile.priceRangeMin != null || profile.priceRangeMax != null
    },
    {
      key: "typicalVolume",
      filled: Boolean(profile.typicalVolume?.trim())
    },
    {
      key: "profilePhotoUrl",
      filled: Boolean(profile.profilePhotoUrl?.trim())
    }
  ];
}

/** Calcule le % de complétion du profil acheteur (champs métier + préférences). */
export function buyerProfileCompletionPercent(
  profile: BuyerProfileCompletionInput | null | undefined
): number {
  if (!profile) return 0;
  const checks = fieldChecks(profile);
  const done = checks.filter((c) => c.filled).length;
  return Math.round((done / checks.length) * 100);
}

/** Premier champ vide, pour la ligne de suggestion sous la jauge. */
export function buyerProfileNextEmptyField(
  profile: BuyerProfileCompletionInput | null | undefined
): BuyerProfileFieldKey | null {
  if (!profile) return "buyerType";
  const empty = fieldChecks(profile).find((c) => !c.filled);
  return empty?.key ?? null;
}
