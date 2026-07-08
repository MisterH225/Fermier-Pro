import { by, device, element, expect, waitFor } from "detox";

export const MERCHANT_SHOPS_DEEP_LINK = "fermier-pro://merchant/shops";

const SHOPS_SCREEN = "merchant-shops-screen";
const DASHBOARD_SCROLL = "merchant-dashboard-scroll";

export async function launchMerchantAppFresh(): Promise<void> {
  await device.launchApp({ newInstance: true });
}

export async function openMerchantShopsViaDeepLink(): Promise<void> {
  await device.openURL({ url: MERCHANT_SHOPS_DEEP_LINK });
  await waitFor(element(by.id(SHOPS_SCREEN)))
    .toBeVisible()
    .withTimeout(15_000);
}

export async function navigateToMerchantShopsTab(): Promise<void> {
  await element(by.id("merchant-tab-shops")).tap();
  await waitFor(element(by.id(SHOPS_SCREEN)))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function navigateToMerchantHome(): Promise<void> {
  await element(by.id("merchant-tab-home")).tap();
  await waitFor(element(by.id(DASHBOARD_SCROLL)))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function expectOnMerchantShopsScreen(): Promise<void> {
  await expect(element(by.id(SHOPS_SCREEN))).toBeVisible();
}

export async function tapCreateShopFromShops(): Promise<void> {
  await element(by.id("merchant-shops-create")).tap();
  await waitFor(element(by.id("merchant-shop-form-screen")))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function tapCreateShopFromEmptyState(): Promise<void> {
  await element(by.id("merchant-shops-empty-create")).tap();
  await waitFor(element(by.id("merchant-shop-form-screen")))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function tapAddProductFromFirstShop(): Promise<void> {
  await element(by.text("Ajouter un produit")).atIndex(0).tap();
  await waitFor(element(by.id("merchant-product-form-screen")))
    .toBeVisible()
    .withTimeout(10_000);
}

export async function openMerchantProductFormViaDeepLink(shopId: string): Promise<void> {
  await device.openURL({
    url: `fermier-pro://merchant/product-form?shopId=${encodeURIComponent(shopId)}`
  });
  await waitFor(element(by.id("merchant-product-form-screen")))
    .toBeVisible()
    .withTimeout(15_000);
}
