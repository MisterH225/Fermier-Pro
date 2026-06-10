import {
  effectiveFeedPhase,
  feedPhasesCompatible,
  inferFeedPhaseFromName,
  resolveBatchFeedPhase
} from "./feed-production-phase.util";

describe("feed-production-phase.util", () => {
  it("infère sous mère et démarrage", () => {
    expect(inferFeedPhaseFromName("Aliment sous mère").phase).toBe("sous_mere");
    expect(inferFeedPhaseFromName("Aliment démarrage porcelet").phase).toBe(
      "starter"
    );
    expect(inferFeedPhaseFromName("Transition sevrage").phase).toBe(
      "transition"
    );
  });

  it("résout la phase bande selon l'âge", () => {
    expect(
      resolveBatchFeedPhase({
        categoryKey: "starter",
        avgAgeWeeks: 2
      })
    ).toBe("sous_mere");
    expect(
      resolveBatchFeedPhase({
        categoryKey: "starter",
        avgAgeWeeks: 4
      })
    ).toBe("transition");
    expect(
      resolveBatchFeedPhase({
        categoryKey: "starter",
        avgAgeWeeks: 8
      })
    ).toBe("starter");
    expect(
      resolveBatchFeedPhase({
        categoryKey: "fattening",
        avgAgeWeeks: 20
      })
    ).toBe("fattening");
  });

  it("compatibilité phases adjacentes", () => {
    expect(feedPhasesCompatible("transition", "starter")).toBe(true);
    expect(feedPhasesCompatible("fattening", "starter")).toBe(false);
    expect(effectiveFeedPhase("unknown", "Aliment démarrage")).toBe("starter");
  });
});
