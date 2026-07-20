import type { VetPublicProfileDto } from "./api";

export type VetProfileFieldKey =
  | "bio"
  | "otherSpecialties"
  | "interventionRadiusKm"
  | "profilePhotoUrl"
  | "availability";

type FieldCheck = {
  key: VetProfileFieldKey;
  filled: boolean;
};

function fieldChecks(profile: VetPublicProfileDto): FieldCheck[] {
  return [
    { key: "bio", filled: Boolean(profile.bio?.trim()) },
    {
      key: "otherSpecialties",
      filled: Boolean(profile.otherSpecialties?.length)
    },
    {
      key: "interventionRadiusKm",
      filled:
        profile.interventionRadiusKm != null &&
        profile.interventionRadiusKm > 0
    },
    {
      key: "profilePhotoUrl",
      filled: Boolean(profile.profilePhotoUrl?.trim())
    },
    /** Toggle toujours défini côté profil — compté dès que présent. */
    { key: "availability", filled: typeof profile.availability === "boolean" }
  ];
}

/** % de complétion du profil public vétérinaire. */
export function vetProfileCompletionPercent(
  profile: VetPublicProfileDto | null | undefined
): number {
  if (!profile) return 0;
  const checks = fieldChecks(profile);
  const done = checks.filter((c) => c.filled).length;
  return Math.round((done / checks.length) * 100);
}

/** Premier champ public vide, pour la suggestion sous la jauge. */
export function vetProfileNextEmptyField(
  profile: VetPublicProfileDto | null | undefined
): VetProfileFieldKey | null {
  if (!profile) return "bio";
  return fieldChecks(profile).find((c) => !c.filled)?.key ?? null;
}
