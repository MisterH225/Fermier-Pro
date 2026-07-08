/**
 * Detox E2E — écran abonnement commerçant (Free / Premium).
 *
 * Prérequis :
 * - Build Detox (`npm run e2e:build:ios` ou `e2e:build:android`)
 * - API + Metro démarrés
 * - Session commerçant authentifiée (profil merchant actif)
 * - Pour le flux dashboard → abonnement : commerçant en tier Free (badge visible)
 *
 * Lancer uniquement cette suite :
 *   npm run test:e2e:merchant-subscription
 */
import { by, device, element, expect } from "detox";
import {
  expectOnMerchantDashboard,
  expectSubscriptionCtaLabel,
  expectSubscriptionCtaLabelMatches,
  launchMerchantAppFresh,
  openMerchantSubscriptionFromDashboard,
  openMerchantSubscriptionViaDeepLink,
  selectSubscriptionPlan,
  tapSubscriptionCancel
} from "./helpers/merchantSubscription";

describe("MerchantSubscription — écran abonnement commerçant", () => {
  beforeAll(async () => {
    await launchMerchantAppFresh();
  });

  describe("via deep link", () => {
    beforeAll(async () => {
      await openMerchantSubscriptionViaDeepLink();
    });

    it("affiche le titre et les deux cartes de plan", async () => {
      await expect(element(by.id("merchant-subscription-screen"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-title"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-plan-free"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-plan-premium"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-cta"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-cancel"))).toBeVisible();
    });

    it("plan Free sélectionné par défaut — CTA gratuit", async () => {
      await selectSubscriptionPlan("free");
      await expectSubscriptionCtaLabel("Commencer gratuitement");
    });

    it("sélection Premium — CTA avec prix", async () => {
      await selectSubscriptionPlan("premium");
      await expectSubscriptionCtaLabelMatches(/Choisir Premium/);
      await expectSubscriptionCtaLabelMatches(/XOF/);
    });

    it("bascule Free → Premium → Free met à jour le CTA", async () => {
      await selectSubscriptionPlan("premium");
      await expectSubscriptionCtaLabelMatches(/Choisir Premium/);

      await selectSubscriptionPlan("free");
      await expectSubscriptionCtaLabel("Commencer gratuitement");
    });

    it("annuler retourne au tableau de bord commerçant", async () => {
      await tapSubscriptionCancel();
      await expectOnMerchantDashboard();
    });
  });

  describe("navigation depuis le dashboard", () => {
    beforeAll(async () => {
      await device.reloadReactNative();
      await openMerchantSubscriptionFromDashboard();
    });

    it("ouvre l'écran via le bouton Passer Premium", async () => {
      await expect(element(by.id("merchant-subscription-screen"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-plan-free"))).toBeVisible();
      await expect(element(by.id("merchant-subscription-plan-premium"))).toBeVisible();
    });

    it("annuler depuis la stack revient au dashboard", async () => {
      await tapSubscriptionCancel();
      await expectOnMerchantDashboard();
    });
  });
});
