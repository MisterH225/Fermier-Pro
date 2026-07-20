/**
 * Source unique de calcul de jauge vétérinaire.
 * Utilisé par VetAccountScreen ET VetOnboardingScreen — ne pas dupliquer.
 */
export type VetProfileFieldKey =
  | "bio"
  | "otherSpecialties"
  | "interventionRadiusKm"
  | "profilePhotoUrl"
  | "availability";

/** Champs nécessaires à la jauge (Compte + onboarding). */
export type VetProfileCompletionInput = {
  bio?: string | null;
  otherSpecialties?: string[] | null;
  interventionRadiusKm?: number | null;
  profilePhotoUrl?: string | null;
  availability?: boolean | null;
};

type FieldCheck = {
  key: VetProfileFieldKey;
  filled: boolean;
};

function fieldChecks(profile: VetProfileCompletionInput): FieldCheck[] {
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
  profile: VetProfileCompletionInput | null | undefined
): number {
  if (!profile) return 0;
  const checks = fieldChecks(profile);
  const done = checks.filter((c) => c.filled).length;
  return Math.round((done / checks.length) * 100);
}

/** Premier champ public vide, pour la suggestion sous la jauge. */
export function vetProfileNextEmptyField(
  profile: VetProfileCompletionInput | null | undefined
): VetProfileFieldKey | null {
  if (!profile) return "bio";
  return fieldChecks(profile).find((c) => !c.filled)?.key ?? null;
}
