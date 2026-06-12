import { isGestationLitterBatch } from "./litter-batch.util";

describe("isGestationLitterBatch", () => {
  it("reconnaît les bandes de mise bas", () => {
    expect(
      isGestationLitterBatch({ sourceTag: "gestation:abc", categoryKey: null })
    ).toBe(true);
    expect(isGestationLitterBatch({ sourceTag: null, categoryKey: "sous_mere" })).toBe(
      true
    );
  });

  it("ignore les bandes onboarding", () => {
    expect(
      isGestationLitterBatch({ sourceTag: "onboarding", categoryKey: "starter" })
    ).toBe(false);
  });
});
