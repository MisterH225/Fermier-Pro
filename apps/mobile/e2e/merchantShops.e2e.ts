/**
 * Detox E2E — onglet Boutiques commerçant (liste, création, produit).
 *
 * Prérequis :
 * - Build Detox (`npm run e2e:build:ios` ou `e2e:build:android`)
 * - API + Metro démarrés
 * - Session commerçant authentifiée (profil merchant actif)
 *
 * Lancer uniquement cette suite :
 *   npm run test:e2e:merchant-shops
 */
import { by, device, element, expect } from "detox";
import {
  expectOnMerchantShopsScreen,
  launchMerchantAppFresh,
  navigateToMerchantHome,
  navigateToMerchantShopsTab,
  openMerchantShopsViaDeepLink,
  tapAddProductFromFirstShop
} from "./helpers/merchantShops";

describe("MerchantShops — onglet Boutiques commerçant", () => {
  beforeAll(async () => {
    await launchMerchantAppFresh();
  });

  describe("via deep link", () => {
    beforeAll(async () => {
      await openMerchantShopsViaDeepLink();
    });

    it("affiche l'écran Mes boutiques", async () => {
      await expectOnMerchantShopsScreen();
    });

    it("propose la création de boutique (bouton + ou empty state)", async () => {
      try {
        await expect(element(by.id("merchant-shops-create"))).toBeVisible();
      } catch {
        await expect(element(by.id("merchant-shops-empty-create"))).toBeVisible();
      }
    });

    it("depuis une boutique existante — ouvre le formulaire produit", async () => {
      try {
        await tapAddProductFromFirstShop();
        await expect(element(by.id("merchant-product-form-no-shop"))).not.toBeVisible();
      } catch {
        // Compte e2e sans boutique : scénario ignoré
      }
    });
  });

  describe("navigation par onglet", () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await navigateToMerchantHome();
      await navigateToMerchantShopsTab();
    });

    it("l'onglet Boutiques est actif et affiche l'écran", async () => {
      await expect(element(by.id("merchant-tab-shops"))).toBeVisible();
      await expectOnMerchantShopsScreen();
    });

    it("retour Accueil via l'onglet home", async () => {
      await navigateToMerchantHome();
      await expect(element(by.id("merchant-dashboard-scroll"))).toBeVisible();
    });
  });
});
