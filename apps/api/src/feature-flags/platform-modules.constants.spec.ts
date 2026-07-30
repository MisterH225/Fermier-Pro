import {
  MODULE_DISABLE_CASCADE,
  MODULE_ENABLE_PREREQUISITES,
  MODULES_DEFAULT_OFF,
  PLATFORM_MODULE_IDS,
  PLATFORM_MODULE_META,
  collectCascadeTargets
} from "./platform-modules.constants";

describe("platform-modules.constants — mills / feed_composition / delivery", () => {
  it("déclare les 3 nouveaux modules", () => {
    expect(PLATFORM_MODULE_IDS).toEqual(
      expect.arrayContaining(["mills", "feed_composition", "delivery"])
    );
  });

  it("les 3 modules sont OFF par défaut", () => {
    expect(MODULES_DEFAULT_OFF).toEqual(
      expect.arrayContaining(["mills", "feed_composition", "delivery"])
    );
  });

  it("expose des libellés / descriptions admin en français", () => {
    for (const id of ["mills", "feed_composition", "delivery"] as const) {
      const meta = PLATFORM_MODULE_META[id];
      expect(meta?.moduleName).toBeTruthy();
      expect(meta?.description).toBeTruthy();
      expect(meta!.moduleName).toMatch(/[A-Za-zÀ-ÿ]/);
    }
    expect(PLATFORM_MODULE_META.mills?.moduleName).toBe("Moulins");
    expect(PLATFORM_MODULE_META.feed_composition?.moduleName).toContain(
      "Composition"
    );
    expect(PLATFORM_MODULE_META.delivery?.moduleName).toBe("Livraison");
  });

  it("applique les prérequis demandés", () => {
    expect(MODULE_ENABLE_PREREQUISITES.mills).toEqual(["marketplace"]);
    expect(MODULE_ENABLE_PREREQUISITES.feed_composition).toEqual(["mills"]);
    expect(MODULE_ENABLE_PREREQUISITES.delivery).toEqual(["marketplace"]);
  });

  it("désactiver mills cascade vers feed_composition", () => {
    expect(collectCascadeTargets("mills")).toEqual(["feed_composition"]);
    expect(MODULE_DISABLE_CASCADE.mills).toEqual(["feed_composition"]);
  });

  it("désactiver marketplace cascade vers buyer + mills + feed_composition + delivery", () => {
    const targets = collectCascadeTargets("marketplace");
    expect(targets).toEqual(
      expect.arrayContaining([
        "buyer",
        "mills",
        "feed_composition",
        "delivery"
      ])
    );
    // mills → feed_composition aussi couvert (BFS)
    expect(new Set(targets).size).toBe(targets.length);
  });
});
