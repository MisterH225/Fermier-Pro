/**
 * Detox E2E — marketplace : feed unifié dans l'onglet Annonces (sans sous-onglet Boutiques).
 *
 * Prérequis : build Detox, API + Metro démarrés, session producteur authentifiée.
 */
import { device } from "detox";
import {
  expectMarketplaceTabsWithoutBoutiques,
  launchMarketplaceAppFresh,
  openMarketplaceListViaDeepLink
} from "./helpers/marketplaceListings";

describe("MarketplaceList — annonces unifiées", () => {
  beforeAll(async () => {
    await launchMarketplaceAppFresh();
  });

  describe("via deep link", () => {
    beforeAll(async () => {
      await openMarketplaceListViaDeepLink();
    });

    it("affiche l'onglet Annonces sans sous-onglet Boutiques", async () => {
      await expectMarketplaceTabsWithoutBoutiques();
    });
  });
});
