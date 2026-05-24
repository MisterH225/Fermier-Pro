import type { AuthMeResponse } from "./api";

/** Onboarding vétérinaire requis tant que le diplôme n’est pas soumis. */
export function needsVetOnboarding(
  authMe: AuthMeResponse | null,
  activeProfileId: string | null
): boolean {
  if (!authMe) {
    return false;
  }
  const active = authMe.profiles.find((p) => p.id === activeProfileId);
  if (active?.type !== "veterinarian") {
    return false;
  }
  const vp = authMe.vetProfessional;
  if (vp?.verificationStatus === "rejected") {
    return true;
  }
  return !vp?.onboardingComplete;
}

/** Profil non vétérinaire pour quitter l’onboarding véto (producteur par défaut). */
export function pickNonVetFallbackProfileId(
  authMe: AuthMeResponse,
  currentProfileId: string | null
): string | null {
  const candidates = authMe.profiles.filter(
    (p) => p.id !== currentProfileId && p.type !== "veterinarian"
  );
  if (candidates.length === 0) {
    return null;
  }
  const preferred =
    candidates.find((p) => p.isDefault) ??
    candidates.find((p) => p.type === "producer") ??
    candidates[0];
  return preferred?.id ?? null;
}
