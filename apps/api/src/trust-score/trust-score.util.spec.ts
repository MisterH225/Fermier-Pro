import { TrustScoreLevel } from "@prisma/client";
import {
  aggregatePillars,
  bayesianRatingScore,
  redistributeWeights,
  type PillarInput
} from "./trust-score.util";

describe("trust-score.util", () => {
  describe("bayesianRatingScore", () => {
    it("2 avis 5★ restent proches du neutre (prior fort)", () => {
      const score = bayesianRatingScore([5, 5]);
      expect(score).not.toBeNull();
      // (5*3.5 + 10) / 7 = 3.928 → ~78.6 — pas excellent extrême
      expect(score!).toBeGreaterThan(70);
      expect(score!).toBeLessThan(85);
    });

    it("30 avis 5★ approchent l'excellent", () => {
      const score = bayesianRatingScore(Array(30).fill(5));
      expect(score).not.toBeNull();
      // (5*3.5 + 150) / 35 = 4.785 → ~95.7
      expect(score!).toBeGreaterThanOrEqual(90);
    });

    it("retourne null sans avis", () => {
      expect(bayesianRatingScore([])).toBeNull();
    });
  });

  describe("redistributeWeights", () => {
    it("un pilier sans données n'écrase pas le score (poids redistribué)", () => {
      const pillars: PillarInput[] = [
        { key: "a", score: 100, weight: 0.5, sampleSize: 10, hasData: true },
        { key: "b", score: null, weight: 0.5, sampleSize: 0, hasData: false }
      ];
      const { active, totalActiveWeight } = redistributeWeights(pillars);
      expect(totalActiveWeight).toBe(0.5);
      expect(active).toHaveLength(1);
      expect(active[0]!.effectiveWeight).toBe(1);
      expect(active[0]!.key).toBe("a");

      const agg = aggregatePillars(pillars, {
        userCreatedAt: new Date(Date.now() - 60 * 86_400_000),
        transactionCount: 10
      });
      // Seul le pilier A compte → score 100, pas 50
      expect(agg.score).toBe(100);
      expect(agg.isNew).toBe(false);
    });
  });

  describe("aggregatePillars — état nouvelle", () => {
    it("compte jeune + peu de transactions → nouvelle (score neutre)", () => {
      const pillars: PillarInput[] = [
        { key: "a", score: 10, weight: 1, sampleSize: 1, hasData: true }
      ];
      const agg = aggregatePillars(pillars, {
        userCreatedAt: new Date(Date.now() - 5 * 86_400_000),
        transactionCount: 1
      });
      expect(agg.isNew).toBe(true);
      expect(agg.level).toBe(TrustScoreLevel.nouvelle);
      expect(agg.score).toBe(50);
      expect(agg.sampleSizes.transactionCount).toBe(1);
    });
  });

  describe("litiges résolus contre vs classés sans faute", () => {
    it("taux de litiges perdus pénalise ; zéro litige perdu reste excellent", () => {
      // Simule disputeRecord : 0 perdus / 10 tx → 100
      const clean: PillarInput[] = [
        {
          key: "disputeRecord",
          score: 100,
          weight: 1,
          sampleSize: 10,
          hasData: true
        }
      ];
      const cleanAgg = aggregatePillars(clean, {
        userCreatedAt: new Date(Date.now() - 90 * 86_400_000),
        transactionCount: 10
      });
      expect(cleanAgg.score).toBe(100);
      expect(cleanAgg.level).toBe(TrustScoreLevel.ensoleille);

      // 3 perdus / 10 → 70
      const dirty: PillarInput[] = [
        {
          key: "disputeRecord",
          score: 70,
          weight: 1,
          sampleSize: 10,
          hasData: true
        }
      ];
      const dirtyAgg = aggregatePillars(dirty, {
        userCreatedAt: new Date(Date.now() - 90 * 86_400_000),
        transactionCount: 10
      });
      expect(dirtyAgg.score).toBe(70);
      expect(dirtyAgg.level).toBe(TrustScoreLevel.eclaircies);
    });
  });

  describe("fenêtre 90 j (comportemental vs avis)", () => {
    it("documente que les avis bayésiens ne dépendent pas de la fenêtre", () => {
      // Les avis sont passés en cumul ; la fenêtre 90 j est appliquée
      // côté métriques comportementales uniquement.
      const recent = bayesianRatingScore([5, 5, 5, 5, 5]);
      const sameCumulative = bayesianRatingScore([5, 5, 5, 5, 5]);
      expect(recent).toBe(sameCumulative);
    });
  });
});
