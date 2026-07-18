import { producerMainTabFromRoute } from "../producerMainTabFromRoute";
import { producerMainTabs } from "../producerMainTabs";
import { producerExtendedMenuIds } from "../producerExtendedMenuIds";

describe("producerMainTabs", () => {
  it("place marketplace dans les deux variantes finance", () => {
    expect(producerMainTabs(true)).toEqual([
      "home",
      "cheptel",
      "health",
      "marketplace",
      "finance"
    ]);
    expect(producerMainTabs(false)).toEqual([
      "home",
      "cheptel",
      "health",
      "marketplace"
    ]);
  });

  it("ne contient plus l’onglet feed", () => {
    expect(producerMainTabs(true)).not.toContain("feed");
    expect(producerMainTabs(false)).not.toContain("feed");
  });
});

describe("producerMainTabFromRoute", () => {
  it("mappe MarketplaceList et écrans marché vers marketplace", () => {
    expect(producerMainTabFromRoute("MarketplaceList", true)).toBe(
      "marketplace"
    );
    expect(producerMainTabFromRoute("MarketplaceListingDetail", true)).toBe(
      "marketplace"
    );
    expect(producerMainTabFromRoute("MarketplaceTransaction", false)).toBe(
      "marketplace"
    );
    expect(producerMainTabFromRoute("CreateMarketplaceListing", true)).toBe(
      "marketplace"
    );
  });

  it("mappe FarmGestation et FarmLivestock vers cheptel", () => {
    expect(producerMainTabFromRoute("FarmGestation", true)).toBe("cheptel");
    expect(producerMainTabFromRoute("FarmLivestock", true)).toBe("cheptel");
    expect(producerMainTabFromRoute("AnimalDetail", false)).toBe("cheptel");
  });

  it("ne mappe plus CommunityFeed vers un onglet principal", () => {
    expect(producerMainTabFromRoute("CommunityFeed", true)).toBeNull();
  });

  it("respecte financeEnabled pour FarmFinance", () => {
    expect(producerMainTabFromRoute("FarmFinance", true)).toBe("finance");
    expect(producerMainTabFromRoute("FarmFinance", false)).toBeNull();
  });
});

describe("producerExtendedMenuIds", () => {
  it("expose la tuile Communauté et retire le marché", () => {
    const ids = producerExtendedMenuIds();
    expect(ids).toContain("communityFeed");
    expect(ids).not.toContain("market");
    expect(ids).toContain("gestation");
  });
});
