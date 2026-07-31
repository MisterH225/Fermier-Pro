import { parseFeedCompositionCardMessage } from "../feedCompositionChatMessage";

describe("parseFeedCompositionCardMessage", () => {
  it("parse une carte valide", () => {
    const body = JSON.stringify({
      _type: "feed_composition_card",
      variant: "adjustment",
      compositionId: "c1",
      farmId: "f1",
      stage: "finishing",
      status: "vet_review",
      feasible: true,
      totalCostXof: 1000,
      costPerKg: 10,
      totalFeedKg: 100,
      dailyIntakeKg: 1,
      ration: [],
      nutritionResult: null,
      deviations: [],
      infeasibilityReasons: [],
      nutritionDelta: null,
      versionId: "v1",
      proposedByUserId: "u1"
    });
    const parsed = parseFeedCompositionCardMessage(body);
    expect(parsed?.compositionId).toBe("c1");
    expect(parsed?.variant).toBe("adjustment");
  });

  it("ignore le texte libre", () => {
    expect(parseFeedCompositionCardMessage("bonjour")).toBeNull();
  });
});
