import type { BuyerDashboardDto } from "./api";

/** Calcule le % de complétion du profil acheteur (champs métier + préférences). */
export function buyerProfileCompletionPercent(
  profile: BuyerDashboardDto["profile"] | null | undefined
): number {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.buyerType),
    profile.buyerType !== "professional" || Boolean(profile.businessName?.trim()),
    Boolean(profile.preferredCategories?.length),
    profile.priceRangeMin != null || profile.priceRangeMax != null,
    Boolean(profile.typicalVolume?.trim()),
    profile.searchRadiusKm != null && profile.searchRadiusKm > 0,
    Boolean(profile.locationLabel?.trim()) ||
      (profile.homeLatitude != null && profile.homeLongitude != null),
    Boolean(profile.profilePhotoUrl?.trim())
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
