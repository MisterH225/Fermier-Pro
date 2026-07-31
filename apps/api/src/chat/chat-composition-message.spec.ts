import {
  buildFeedCompositionCardBody,
  feedCompositionCardPreview,
  parseFeedCompositionCardBody,
  type FeedCompositionCardPayload
} from "./chat-composition-message";

const sample: FeedCompositionCardPayload = {
  _type: "feed_composition_card",
  variant: "initial",
  compositionId: "c1",
  farmId: "f1",
  stage: "finishing",
  status: "vet_review",
  feasible: true,
  totalCostXof: 20000,
  costPerKg: 200,
  totalFeedKg: 100,
  dailyIntakeKg: 1.5,
  ration: [
    {
      feedIngredientId: "corn",
      canonicalName: "Maïs",
      quantityKg: 70,
      proportionPct: 70,
      costContribution: 14000
    }
  ],
  nutritionResult: null,
  deviations: [],
  infeasibilityReasons: [],
  nutritionDelta: null,
  versionId: "v1",
  proposedByUserId: "u1"
};

describe("chat-composition-message", () => {
  it("round-trip JSON", () => {
    const body = buildFeedCompositionCardBody(sample);
    expect(parseFeedCompositionCardBody(body)).toEqual(sample);
  });

  it("preview lisible", () => {
    expect(feedCompositionCardPreview(sample)).toMatch(/Composition à valider/);
    expect(
      feedCompositionCardPreview({ ...sample, variant: "adjustment" })
    ).toMatch(/Ajustement/);
  });
});
