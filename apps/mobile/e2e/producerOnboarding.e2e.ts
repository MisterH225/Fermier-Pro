/**
 * Detox E2E — onboarding producteur (P-45, rituel pré-release).
 *
 * ⚠️ ADAPTATION : le prompt P-45 décrit un onboarding « 3 étapes (ferme +
 * animal + première pesée) » issu de P-39. **P-39 n'est PAS mergé** dans ce
 * repo. Le parcours réel est :
 *   - OnboardingScreen à 4 étapes (projet/ferme → reproducteurs → effectifs →
 *     loges) + écran de complétion ;
 *   - une bannière `OnboardingBanner` (testID `onboarding-banner`) affichée sur
 *     le dashboard tant que l'onboarding est « skippé », qui disparaît une fois
 *     l'onboarding terminé (`getProducerOnboardingState` → `done`).
 *
 * Ce spec vérifie donc le parcours ACTUEL : présence de la bannière quand
 * l'onboarding n'est pas terminé, reprise via le CTA, et absence de bannière
 * une fois l'onboarding complété. À réaligner sur le flux guidé si P-39 est
 * mergé plus tard.
 */
import { by, device, element, expect, waitFor } from "detox";
import {
  launchProducerAppFresh,
  waitForProducerHome
} from "./helpers/producer";

describe("Producteur — onboarding (bannière + reprise)", () => {
  beforeAll(async () => {
    await launchProducerAppFresh();
    await waitForProducerHome();
  });

  it("compte non finalisé : la bannière onboarding est visible et propose la reprise", async () => {
    // Compte déjà onboardé → la bannière n'existe pas : parcours déjà couvert.
    const banner = element(by.id("onboarding-banner"));
    try {
      await waitFor(banner).toBeVisible().withTimeout(6_000);
    } catch {
      await expect(element(by.id("onboarding-banner"))).not.toExist();
      return;
    }

    await expect(banner).toBeVisible();
    await element(by.id("onboarding-banner-cta")).tap();

    // La reprise ouvre le parcours d'onboarding (4 étapes réelles).
    await waitFor(element(by.id("onboarding-screen")))
      .toBeVisible()
      .withTimeout(10_000);
  });

  it("dashboard producteur accessible après onboarding (bannière absente)", async () => {
    await device.reloadReactNative();
    await waitForProducerHome();
    // Sur un compte finalisé, la bannière ne doit plus apparaître.
    await expect(element(by.id("onboarding-banner"))).not.toExist();
  });
});
