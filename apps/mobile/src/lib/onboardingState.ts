import type { AuthMeResponse } from "./api";

export type ProducerOnboardingState =
  | "not_applicable"
  | "required"
  | "skipped"
  | "done";

export function getProducerOnboardingState(
  authMe: AuthMeResponse | null,
  activeProfileId: string | null | undefined
): ProducerOnboardingState {
  if (!authMe || !activeProfileId) {
    return "not_applicable";
  }
  const profile = authMe.profiles.find((p) => p.id === activeProfileId);
  if (profile?.type !== "producer") {
    return "not_applicable";
  }
  const isOnboarded =
    authMe.user.isOnboarded ?? Boolean(authMe.primaryFarm);
  const onboardingSkipped = authMe.user.onboardingSkipped ?? false;

  if (isOnboarded) {
    return "done";
  }
  if (onboardingSkipped) {
    return "skipped";
  }
  return "required";
}

export function shouldShowOnboardingScreen(
  state: ProducerOnboardingState,
  resumeActive: boolean
): boolean {
  return state === "required" || (state === "skipped" && resumeActive);
}
