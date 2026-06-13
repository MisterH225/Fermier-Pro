import { ProducerScore } from "@prisma/client";
import {
  deriveProducerScore,
  scoreFromActiveDays,
  scoreResponsiveness
} from "./producer-score.util";

describe("producer-score.util", () => {
  it("scoreFromActiveDays maps day counts", () => {
    expect(scoreFromActiveDays(20)).toBe(100);
    expect(scoreFromActiveDays(0)).toBe(5);
  });

  it("scoreResponsiveness blends offer and reputation signals", () => {
    const high = scoreResponsiveness({
      offersReceived: 10,
      offersRespondedWithin48h: 9,
      creditBalancesOnTime: 2,
      creditBalancesTotal: 2,
      reputationScore: 95
    });
    expect(high).toBeGreaterThan(80);

    const low = scoreResponsiveness({
      offersReceived: 10,
      offersRespondedWithin48h: 2,
      creditBalancesOnTime: 0,
      creditBalancesTotal: 2,
      reputationScore: 60
    });
    expect(low).toBeLessThan(50);
  });

  it("deriveProducerScore returns nouveau for new producers", () => {
    expect(
      deriveProducerScore(
        { dataRegularity: 90, platformUsage: 90, responsiveness: 90 },
        true
      )
    ).toBe(ProducerScore.nouveau);
  });

  it("deriveProducerScore returns excellent for strong profiles", () => {
    expect(
      deriveProducerScore(
        { dataRegularity: 90, platformUsage: 85, responsiveness: 85 },
        false
      )
    ).toBe(ProducerScore.excellent);
  });
});
