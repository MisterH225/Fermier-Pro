import { buildFarmDetailMenuItems } from "../buildFarmDetailMenuItems";
import type { FarmDetailMenuKeys } from "../../../lib/menuVisibility";

const menu: FarmDetailMenuKeys = {
  chat: true,
  tasks: true,
  marketplace: true,
  vetConsultations: true,
  finance: true,
  housing: true,
  feedStock: true,
  livestock: true
};

describe("buildFarmDetailMenuItems — Composition", () => {
  it("sans flag → Aliment pointe vers FarmFeedStock", () => {
    const rows = buildFarmDetailMenuItems({
      menu,
      farmId: "f1",
      farmName: "Ferme",
      feedCompositionActive: false
    });
    const feed = rows.find((r) => r.preset === "feed");
    expect(feed?.kind).toBe("navigate");
    if (feed?.kind === "navigate") {
      expect(feed.screen).toBe("FarmFeedStock");
    }
  });

  it("avec flag → Aliment pointe vers FarmFeedHub", () => {
    const rows = buildFarmDetailMenuItems({
      menu,
      farmId: "f1",
      farmName: "Ferme",
      feedCompositionActive: true
    });
    const feed = rows.find((r) => r.preset === "feed");
    expect(feed?.kind).toBe("navigate");
    if (feed?.kind === "navigate") {
      expect(feed.screen).toBe("FarmFeedHub");
      expect(feed.subtitle).toMatch(/composition/i);
    }
  });
});
