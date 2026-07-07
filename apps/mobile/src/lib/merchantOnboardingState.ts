import type { AuthMeResponse } from "./api";

export function needsMerchantOnboarding(
  authMe: AuthMeResponse | null,
  activeProfileId: string | null
): boolean {
  if (!authMe) {
    return false;
  }
  const active = authMe.profiles.find((p) => p.id === activeProfileId);
  if (active?.type !== "merchant") {
    return false;
  }
  return !authMe.merchantProfile?.onboardingComplete;
}
