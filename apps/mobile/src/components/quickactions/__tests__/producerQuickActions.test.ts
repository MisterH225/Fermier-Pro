import {
  isProducerQuickActionRootRoute,
  PRODUCER_QUICK_ACTION_IDS,
  PRODUCER_QUICK_ACTION_ROOT_ROUTES,
  producerQuickFabBottomOffset,
  producerQuickFabListClearance,
  producerQuickFabMetrics
} from "../producerQuickActions";
import { producerBottomChromeHeight } from "../../navigation/producerNavMetrics";

describe("producerQuickActions root routes", () => {
  it("inclut les écrans racine producteur dont Aliment", () => {
    expect([...PRODUCER_QUICK_ACTION_ROOT_ROUTES]).toEqual([
      "ProducerDashboard",
      "FarmLivestock",
      "FarmHealth",
      "MarketplaceList",
      "FarmFinance",
      "FarmFeedStock"
    ]);
  });

  it("est visible sur les racines et absent sur un détail", () => {
    expect(isProducerQuickActionRootRoute("ProducerDashboard")).toBe(true);
    expect(isProducerQuickActionRootRoute("FarmLivestock")).toBe(true);
    expect(isProducerQuickActionRootRoute("MarketplaceList")).toBe(true);
    expect(isProducerQuickActionRootRoute("FarmFeedStock")).toBe(true);
    expect(isProducerQuickActionRootRoute("AnimalDetail")).toBe(false);
    expect(isProducerQuickActionRootRoute("BatchDetail")).toBe(false);
    expect(isProducerQuickActionRootRoute("CreateMarketplaceListing")).toBe(
      false
    );
  });
});

describe("producerQuickFabBottomOffset", () => {
  it("calcule l’offset depuis le chrome tab bar + inset (pas de valeur en dur)", () => {
    const inset = 34;
    const metrics = producerQuickFabMetrics();
    expect(producerQuickFabBottomOffset(inset)).toBe(
      producerBottomChromeHeight(inset) + metrics.fabGap
    );
    expect(producerQuickFabBottomOffset(inset)).toBe(
      metrics.navFloatBottom + metrics.navBarHeight + inset + metrics.fabGap
    );
    expect(producerQuickFabBottomOffset(0)).not.toBe(
      producerQuickFabBottomOffset(34)
    );
  });

  it("réserve assez d’espace liste pour le FAB", () => {
    const metrics = producerQuickFabMetrics();
    expect(producerQuickFabListClearance()).toBe(
      metrics.fabSize + metrics.fabGap
    );
  });
});

describe("PRODUCER_QUICK_ACTION_IDS", () => {
  it("expose les gestes cheptel/finance et aliment", () => {
    expect(PRODUCER_QUICK_ACTION_IDS).toEqual([
      "weigh",
      "mortality",
      "farrowing",
      "sell",
      "expense",
      "feedIn",
      "stockCheck"
    ]);
  });
});

describe("quick action navigation params", () => {
  it("définit les params attendus pour chaque action", () => {
    const farm = { farmId: "f1", farmName: "Ferme" };

    expect({
      mortality: {
        screen: "FarmHealth",
        params: {
          ...farm,
          initialTab: "mortality",
          openFormKind: "mortality"
        }
      },
      farrowing: {
        screen: "FarmGestation",
        params: {
          ...farm,
          initialTab: "birth",
          autoOpenLitter: true
        }
      },
      expense: {
        screen: "FarmFinance",
        params: {
          ...farm,
          initialTab: "depenses",
          openTransaction: true
        }
      },
      feedIn: {
        screen: "FarmFeedStock",
        params: {
          ...farm,
          autoOpenEntry: true
        }
      },
      stockCheck: {
        screen: "FarmFeedStock",
        params: {
          ...farm,
          autoOpenControl: true
        }
      },
      sellMarketplace: {
        screen: "CreateMarketplaceListing",
        params: { farmId: farm.farmId }
      }
    }).toMatchObject({
      mortality: {
        params: { openFormKind: "mortality", initialTab: "mortality" }
      },
      farrowing: { params: { autoOpenLitter: true, initialTab: "birth" } },
      expense: { params: { openTransaction: true, initialTab: "depenses" } },
      feedIn: { params: { autoOpenEntry: true } },
      stockCheck: { params: { autoOpenControl: true } },
      sellMarketplace: { params: { farmId: "f1" } }
    });
  });
});
