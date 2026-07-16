import { by, device, element, expect, waitFor } from "detox";

export const MARKETPLACE_LIST_DEEP_LINK = "fermier-pro://market/list";

export async function launchMarketplaceAppFresh(): Promise<void> {
  await device.launchApp({ newInstance: true });
}

export async function openMarketplaceListViaDeepLink(): Promise<void> {
  await device.openURL({ url: MARKETPLACE_LIST_DEEP_LINK });
  await waitFor(element(by.id("marketplace-list-screen")))
    .toBeVisible()
    .withTimeout(15_000);
}

export async function expectMarketplaceTabsWithoutBoutiques(): Promise<void> {
  await expect(element(by.id("market-tab-bar"))).toBeVisible();
  await expect(element(by.id("market-tab-listings"))).toBeVisible();
  await expect(element(by.id("market-tab-prices"))).toBeVisible();
  await expect(element(by.id("market-tab-boutiques"))).not.toExist();
}
