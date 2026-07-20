import type { ProfileCompletionBucket } from "./app-events.constants";

/** Buckets d'adoption jauge profil (alignés produit). */
export function profileCompletionBucket(
  percent: number
): ProfileCompletionBucket {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  if (p < 40) return "0-40";
  if (p < 70) return "40-70";
  return "70-100";
}

type BuyerProfileLike = {
  buyerType?: string | null;
  businessName?: string | null;
  locationLabel?: string | null;
  homeLatitude?: { toNumber?: () => number } | number | null;
  homeLongitude?: { toNumber?: () => number } | number | null;
  searchRadiusKm?: number | null;
  preferredCategories?: unknown;
  priceRangeMin?: unknown;
  priceRangeMax?: unknown;
  typicalVolume?: string | null;
  profilePhotoUrl?: string | null;
};

function hasCoord(v: BuyerProfileLike["homeLatitude"]): boolean {
  if (v == null) return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v.toNumber === "function") {
    return Number.isFinite(v.toNumber());
  }
  return false;
}

function categoriesLen(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  return 0;
}

/** % complétion profil acheteur — miroir mobile `buyerProfileCompletionPercent`. */
export function buyerProfileCompletionPercent(
  profile: BuyerProfileLike | null | undefined
): number {
  if (!profile) return 0;
  const needsBusiness =
    profile.buyerType === "professional" ||
    profile.buyerType === "slaughterhouse" ||
    profile.buyerType === "wholesaler" ||
    profile.buyerType === "reseller";

  const checks = [
    Boolean(profile.buyerType),
    !needsBusiness || Boolean(profile.businessName?.trim()),
    Boolean(profile.locationLabel?.trim()) ||
      (hasCoord(profile.homeLatitude) && hasCoord(profile.homeLongitude)),
    profile.searchRadiusKm != null && profile.searchRadiusKm > 0,
    categoriesLen(profile.preferredCategories) > 0,
    profile.priceRangeMin != null || profile.priceRangeMax != null,
    Boolean(profile.typicalVolume?.trim()),
    Boolean(profile.profilePhotoUrl?.trim())
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

type VetProfileLike = {
  bio?: string | null;
  otherSpecialties?: unknown;
  interventionRadiusKm?: number | null;
  profilePhotoUrl?: string | null;
  availability?: boolean | null;
};

/** % complétion profil véto — miroir mobile `vetProfileCompletionPercent`. */
export function vetProfileCompletionPercent(
  profile: VetProfileLike | null | undefined
): number {
  if (!profile) return 0;
  const specialties = Array.isArray(profile.otherSpecialties)
    ? profile.otherSpecialties.length
    : 0;
  const checks = [
    Boolean(profile.bio?.trim()),
    specialties > 0,
    profile.interventionRadiusKm != null && profile.interventionRadiusKm > 0,
    Boolean(profile.profilePhotoUrl?.trim()),
    typeof profile.availability === "boolean"
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
