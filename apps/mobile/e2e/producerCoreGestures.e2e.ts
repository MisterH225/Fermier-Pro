/**
 * Detox E2E — gestes cœur du producteur (P-45, rituel pré-release).
 *
 * Parcours : accueil → FAB → Pesée (sélection sujet, saisie, confirmation avec
 * insight) → FAB → Vendre → chooser → « Enregistrer une vente déjà conclue » →
 * formulaire de vente pré-réglé (sortie cheptel kind=sale).
 *
 * Prérequis : session producteur authentifiée avec au moins un animal actif,
 * API + Metro démarrés, build Detox à jour.
 */
import { by, device, element, expect, waitFor } from "detox";
import {
  expectSuccessModal,
  launchProducerAppFresh,
  openQuickAction,
  pickFirstWeighAnimal,
  waitForProducerHome
} from "./helpers/producer";

describe("Producteur — gestes cœur (Pesée + Vente conclue)", () => {
  beforeAll(async () => {
    await launchProducerAppFresh();
    await waitForProducerHome();
  });

  it("FAB → Pesée : sélection sujet, saisie, confirmation avec insight", async () => {
    await openQuickAction("weigh");

    await pickFirstWeighAnimal();

    await element(by.id("weigh-weight-input")).replaceText("88.5");
    // Ferme le clavier décimal avant de valider.
    await element(by.id("weigh-weight-input")).tapReturnKey();

    await element(by.id("weigh-save")).tap();

    // Modale de succès (en ligne : message + éventuel insight post-pesée).
    await expectSuccessModal();
    await expect(element(by.id("success-modal"))).toBeVisible();
  });

  it("FAB → Vendre → « vente déjà conclue » : formulaire pré-réglé kind=sale", async () => {
    // Le SuccessModal s'auto-referme ; on revient à l'accueil.
    await waitForProducerHome();

    await openQuickAction("sell");

    // Chooser Vendre partagé (mêmes testID que les fiches animal/bande).
    await waitFor(element(by.id("sell-chooser-recordedSale")))
      .toBeVisible()
      .withTimeout(8_000);
    await element(by.id("sell-chooser-recordedSale")).tap();

    // Sélection de l'animal à vendre (AnimalPickSheet), puis SaleModal (kind=sale).
    await waitFor(element(by.id(/^animal-pick-/)).atIndex(0))
      .toBeVisible()
      .withTimeout(8_000);
    await element(by.id(/^animal-pick-/))
      .atIndex(0)
      .tap();

    // Le formulaire de vente conclue est ouvert (bouton de confirmation présent).
    await waitFor(element(by.id("sale-confirm")))
      .toBeVisible()
      .withTimeout(8_000);
    await expect(element(by.id("sale-confirm"))).toBeVisible();
  });

  afterAll(async () => {
    await device.reloadReactNative();
  });
});
