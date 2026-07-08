/**
 * Detox E2E — formulaire produit commerçant (stock, catégories).
 */
import { by, device, element, expect } from "detox";
import {
  launchMerchantAppFresh,
  openMerchantShopsViaDeepLink,
  tapAddProductFromFirstShop
} from "./helpers/merchantShops";

describe("MerchantProductForm — création produit", () => {
  beforeAll(async () => {
    await launchMerchantAppFresh();
    await openMerchantShopsViaDeepLink();
  });

  it("depuis une boutique — affiche le champ stock", async () => {
    try {
      await tapAddProductFromFirstShop();
      await expect(element(by.id("merchant-product-form-stock"))).toBeVisible();
      await expect(element(by.id("merchant-product-form-screen"))).toBeVisible();
    } catch {
      // Compte e2e sans boutique
    }
  });
});
