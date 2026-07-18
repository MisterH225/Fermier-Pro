import { by, device, element, expect, waitFor } from "detox";

/**
 * Helpers partagés pour la suite fumée producteur (P-45).
 *
 * Prérequis (comme les specs marchandes existantes) : session producteur
 * déjà authentifiée, API + Metro démarrés, build Detox à jour. La session
 * producteur atterrit sur `ProducerDashboard` (route initiale), où le FAB
 * d'actions rapides est visible en permanence.
 */

export const FAB_ID = "producer-quick-actions-fab";

export async function launchProducerAppFresh(): Promise<void> {
  await device.launchApp({ newInstance: true });
}

/** Attend l'écran d'accueil producteur (FAB visible). */
export async function waitForProducerHome(timeout = 20_000): Promise<void> {
  await waitFor(element(by.id(FAB_ID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/** Ouvre le FAB puis sélectionne une action rapide (weigh, sell, …). */
export async function openQuickAction(actionId: string): Promise<void> {
  await element(by.id(FAB_ID)).tap();
  await waitFor(element(by.id(`quick-action-${actionId}`)))
    .toBeVisible()
    .withTimeout(8_000);
  await element(by.id(`quick-action-${actionId}`)).tap();
}

/** Sélectionne le premier animal disponible dans la modale de pesée. */
export async function pickFirstWeighAnimal(): Promise<void> {
  // Les pills portent `weigh-animal-<id>` ; on prend la première visible.
  await waitFor(element(by.id(/^weigh-animal-/)).atIndex(0))
    .toBeVisible()
    .withTimeout(8_000);
  await element(by.id(/^weigh-animal-/))
    .atIndex(0)
    .tap();
}

export async function expectSuccessModal(timeout = 12_000): Promise<void> {
  await waitFor(element(by.id("success-modal")))
    .toBeVisible()
    .withTimeout(timeout);
}
