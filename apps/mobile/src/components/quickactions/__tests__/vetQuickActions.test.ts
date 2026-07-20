import {
  isVetQuickActionRootRoute,
  VET_QUICK_ACTION_IDS,
  VET_QUICK_ACTION_ROOT_ROUTES,
  vetQuickFabBottomOffset,
  vetQuickFabListClearance,
  vetQuickFabMetrics
} from "../vetQuickActions";
import { vetBottomChromeHeight } from "../../navigation/vet/vetNavMetrics";

describe("vetQuickActions root routes", () => {
  it("expose les écrans racine où le FAB est visible", () => {
    expect([...VET_QUICK_ACTION_ROOT_ROUTES]).toEqual([
      "VeterinarianDashboard",
      "VetAgenda",
      "VetFarms"
    ]);
  });

  it("détecte les routes racine", () => {
    expect(isVetQuickActionRootRoute("VeterinarianDashboard")).toBe(true);
    expect(isVetQuickActionRootRoute("VetAgenda")).toBe(true);
    expect(isVetQuickActionRootRoute("VetFarms")).toBe(true);
    expect(isVetQuickActionRootRoute("VetMessages")).toBe(false);
    expect(isVetQuickActionRootRoute("VetAccount")).toBe(false);
    expect(isVetQuickActionRootRoute("VetFarmDetail")).toBe(false);
  });
});

describe("vetQuickFabBottomOffset", () => {
  it("place le FAB au-dessus du chrome tab bar + gap", () => {
    const inset = 34;
    const metrics = vetQuickFabMetrics();
    expect(vetQuickFabBottomOffset(inset)).toBe(
      vetBottomChromeHeight(inset) + metrics.fabGap
    );
    expect(vetQuickFabBottomOffset(inset)).toBe(
      metrics.navFloatBottom + metrics.navBarHeight + inset + metrics.fabGap
    );
    expect(vetQuickFabBottomOffset(0)).not.toBe(vetQuickFabBottomOffset(34));
  });

  it("réserve assez d’espace liste pour le FAB", () => {
    const metrics = vetQuickFabMetrics();
    expect(vetQuickFabListClearance()).toBe(metrics.fabSize + metrics.fabGap);
  });
});

describe("VET_QUICK_ACTION_IDS", () => {
  it("conserve l’ordre des anciennes actions dashboard", () => {
    expect(VET_QUICK_ACTION_IDS).toEqual(["farms", "schedule", "case"]);
  });
});
