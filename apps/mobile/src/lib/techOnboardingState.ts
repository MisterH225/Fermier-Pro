import type { AuthMeResponse } from "./api";

export function needsTechOnboarding(
  authMe: AuthMeResponse | null,
  activeProfileId: string | null
): boolean {
  if (!authMe) {
    return false;
  }
  const active = authMe.profiles.find((p) => p.id === activeProfileId);
  if (active?.type !== "technician") {
    return false;
  }
  return !authMe.technicianProfile?.onboardingComplete;
}

export function pickNonTechnicianFallbackProfileId(
  authMe: AuthMeResponse,
  currentProfileId: string | null
): string | null {
  const candidates = authMe.profiles.filter(
    (p) => p.id !== currentProfileId && p.type !== "technician"
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
