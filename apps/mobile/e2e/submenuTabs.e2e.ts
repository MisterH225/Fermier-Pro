/**
 * Detox E2E — palette unifiée des sous-onglets (modules Cheptel, Santé, Finance, Com).
 *
 * Prérequis : build Detox (`npm run e2e:build:ios` ou `e2e:build:android`),
 * API + Metro démarrés, session producteur authentifiée.
 */
import { by, device, element, expect } from "detox";
import { tabColors } from "../src/theme/tabColors";

const MODULES = [
  {
    name: "Finance",
    navigate: async () => {
      await element(by.id("main-tab-finance")).tap();
    },
    tabPrefix: "finance-tab",
    tabs: ["overview", "rentabilite", "revenus", "depenses"]
  },
  {
    name: "Cheptel",
    navigate: async () => {
      await element(by.id("main-tab-cheptel")).tap();
    },
    tabPrefix: "cheptel-tab",
    tabs: ["overview", "cheptel", "weight", "history"]
  },
  {
    name: "Santé",
    navigate: async () => {
      await element(by.id("main-tab-health")).tap();
    },
    tabPrefix: "sante-tab",
    tabs: ["overview", "vaccination", "disease", "mortality"]
  },
  {
    name: "Com",
    /** Collaboration : menu étendu → écran Collaboration (deep link ou menu). */
    navigate: async () => {
      await element(by.id("extended-menu-collaboration")).tap();
    },
    tabPrefix: "com-tab",
    tabs: ["invite", "directory", "members", "history"]
  }
] as const;

describe("SubMenuTabs — couleur active terracotta", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  for (const mod of MODULES) {
    describe(mod.name, () => {
      beforeAll(async () => {
        await mod.navigate();
        await expect(element(by.id(`${mod.tabPrefix}-bar`))).toBeVisible();
      });

      for (const tabKey of mod.tabs) {
        it(`onglet ${tabKey} actif en terracotta`, async () => {
          const tab = element(by.id(`${mod.tabPrefix}-${tabKey}`));
          await tab.tap();
          await expect(tab).toBeVisible();
          await expect(tab).toHaveStyle({ color: tabColors.ACTIVE });
        });
      }
    });
  }
});
