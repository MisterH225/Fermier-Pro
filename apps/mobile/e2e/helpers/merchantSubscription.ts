import { by, device, element, expect, waitFor } from "detox";

/** Deep link direct vers l'écran abonnement commerçant (profil merchant actif requis). */
export const MERCHANT_SUBSCRIPTION_DEEP_LINK = "fermier-pro://merchant/subscription";

const SUBSCRIPTION_SCREEN = "merchant-subscription-screen";
const DASHBOARD_SCROLL = "merchant-dashboard-scroll";

export async function launchMerchantAppFresh(): Promise<void> {
  await device.launchApp({ newInstance: true });
}

export async function openMerchantSubscriptionViaDeepLink(): Promise<void> {
  await device.openURL({ url: MERCHANT_SUBSCRIPTION_DEEP_LINK });
  await waitFor(element(by.id(SUBSCRIPTION_SCREEN)))
    .toBeVisible()
    .withTimeout(15_000);
}

export async function navigateToMerchantHome(): Promise<void> {
  await element(by.id("merchant-tab-home")).tap();
  await waitFor(element(by.id(DASHBOARD_SCROLL)))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function openMerchantSubscriptionFromDashboard(): Promise<void> {
  await navigateToMerchantHome();
  await element(by.id("merchant-subscription-upgrade-cta")).tap();
  await waitFor(element(by.id(SUBSCRIPTION_SCREEN)))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function expectOnMerchantDashboard(): Promise<void> {
  await waitFor(element(by.id(DASHBOARD_SCROLL)))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function selectSubscriptionPlan(tier: "free" | "premium"): Promise<void> {
  await element(by.id(`merchant-subscription-plan-${tier}`)).tap();
}

export async function tapSubscriptionCta(): Promise<void> {
  await element(by.id("merchant-subscription-cta")).tap();
}

export async function tapSubscriptionCancel(): Promise<void> {
  await element(by.id("merchant-subscription-cancel")).tap();
}

export async function expectSubscriptionCtaLabelMatches(pattern: RegExp): Promise<void> {
  await expect(element(by.id("merchant-subscription-cta-label"))).toHaveText(pattern);
}

export async function expectSubscriptionCtaLabel(text: string): Promise<void> {
  await expect(element(by.id("merchant-subscription-cta-label"))).toHaveText(text);
}
