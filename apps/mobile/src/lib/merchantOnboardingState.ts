import type { AuthMeResponse, MerchantMeDto } from "./api";

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

/** Étape d'onboarding commerçant (0=abonnement, 1=boutique, 2=produit, 3=publish). */
export function resolveMerchantOnboardingStep(
  data: Pick<
    MerchantMeDto,
    | "onboardingComplete"
    | "shopCount"
    | "shops"
    | "activeProductCount"
    | "subscriptionTier"
  >
): number | "finished" {
  if (data.onboardingComplete) {
    return "finished";
  }

  const shopCount = data.shopCount ?? data.shops?.length ?? 0;
  const productCount = data.activeProductCount ?? 0;

  if (shopCount > 0 && productCount > 0) {
    return 3;
  }
  if (shopCount > 0) {
    return 2;
  }
  if (data.subscriptionTier) {
    return 1;
  }
  return 0;
}
