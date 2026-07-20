import type { BuyerDashboardDto } from "./api";

export type BuyerProfileFieldKey =
  | "buyerType"
  | "businessName"
  | "locationLabel"
  | "searchRadiusKm"
  | "preferredCategories"
  | "priceRange"
  | "typicalVolume"
  | "profilePhotoUrl";

type BuyerProfile = BuyerDashboardDto["profile"];

type FieldCheck = {
  key: BuyerProfileFieldKey;
  filled: boolean;
};

function fieldChecks(profile: NonNullable<BuyerProfile>): FieldCheck[] {
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
  profile: BuyerProfile | null | undefined
): number {
  if (!profile) return 0;
  const checks = fieldChecks(profile);
  const done = checks.filter((c) => c.filled).length;
  return Math.round((done / checks.length) * 100);
}

/** Premier champ vide, pour la ligne de suggestion sous la jauge. */
export function buyerProfileNextEmptyField(
  profile: BuyerProfile | null | undefined
): BuyerProfileFieldKey | null {
  if (!profile) return "buyerType";
  const empty = fieldChecks(profile).find((c) => !c.filled);
  return empty?.key ?? null;
}
