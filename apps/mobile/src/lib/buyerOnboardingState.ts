import type { AuthMeResponse } from "./api";

export function needsBuyerOnboarding(
  authMe: AuthMeResponse | null,
  activeProfileId: string | null
): boolean {
  if (!authMe) {
    return false;
  }
  const active = authMe.profiles.find((p) => p.id === activeProfileId);
  if (active?.type !== "buyer") {
    return false;
  }
  return !authMe.buyerProfile?.onboardingComplete;
}

export function pickNonBuyerFallbackProfileId(
  authMe: AuthMeResponse,
  currentProfileId: string | null
): string | null {
  const candidates = authMe.profiles.filter(
    (p) => p.id !== currentProfileId && p.type !== "buyer"
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
