import { canOrderFeedComposition } from "../../../lib/feedComposition";

describe("FeedCompositionDetail order button visibility", () => {
  it("validated + producteur finance.write → peut commander", () => {
    expect(
      canOrderFeedComposition({
        profileType: "producer",
        effectiveScopes: ["finance.write"],
        writeLocked: false
      })
    ).toBe(true);
  });

  it("validated mais véto → ne peut pas commander", () => {
    expect(
      canOrderFeedComposition({
        profileType: "veterinarian",
        effectiveScopes: ["*"]
      })
    ).toBe(false);
  });

  it("validated mais ferme verrouillée → ne peut pas commander", () => {
    expect(
      canOrderFeedComposition({
        profileType: "producer",
        effectiveScopes: ["finance.write"],
        writeLocked: true
      })
    ).toBe(false);
  });
});
