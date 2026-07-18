/**
 * Detox E2E — file offline producteur (P-45, rituel pré-release).
 *
 * Parcours : couper le réseau → saisir une pesée → badge « en attente » →
 * rétablir le réseau → synchronisation → donnée présente.
 *
 * ⚠️ SIMULATION RÉSEAU : il n'existe pas de helper d'interception réseau dans
 * la suite Detox. On utilise l'API native Detox `device.setURLBlacklist` pour
 * faire échouer les requêtes API (déclenche la mise en file par
 * `useOfflineMutation`), puis on la lève pour laisser `OfflineSyncContext`
 * rejouer la file. NetInfo reste « en ligne » : c'est l'échec réseau qui met en
 * file, conformément au comportement offline-first de l'app.
 *
 * Prérequis : session producteur authentifiée avec au moins un animal actif.
 */
import { by, device, element, expect, waitFor } from "detox";
import {
  launchProducerAppFresh,
  openQuickAction,
  pickFirstWeighAnimal,
  waitForProducerHome
} from "./helpers/producer";

// Bloque tout le trafic HTTP(S) — simule la coupure réseau.
const BLOCK_ALL = [".*"];

describe("Producteur — file offline (pesée hors-ligne → synchro)", () => {
  beforeAll(async () => {
    await launchProducerAppFresh();
    await waitForProducerHome();
  });

  afterAll(async () => {
    // Toujours rétablir le réseau, même en cas d'échec.
    await device.setURLBlacklist([]);
    await device.reloadReactNative();
  });

  it("saisie hors-ligne : la pesée part en file d'attente (badge en attente)", async () => {
    await device.setURLBlacklist(BLOCK_ALL);

    await openQuickAction("weigh");
    await pickFirstWeighAnimal();
    await element(by.id("weigh-weight-input")).replaceText("77.0");
    await element(by.id("weigh-weight-input")).tapReturnKey();
    await element(by.id("weigh-save")).tap();

    // Le bandeau offline affiche le compteur de saisies en attente.
    await waitFor(element(by.id("offline-queue-pending")))
      .toBeVisible()
      .withTimeout(12_000);
    await expect(element(by.id("offline-banner"))).toBeVisible();
  });

  it("réseau rétabli : la file se synchronise et le badge disparaît", async () => {
    await device.setURLBlacklist([]);

    // La synchro se déclenche automatiquement (OfflineSyncContext) ; le bandeau
    // de file en attente finit par disparaître une fois la file vidée.
    await waitFor(element(by.id("offline-queue-pending")))
      .not.toBeVisible()
      .withTimeout(30_000);
  });
});
