import { TrustScoreLevel } from "@prisma/client";
import { TRUST_PILLAR_WEIGHTS } from "./trust-score.constants";
import {
  aggregatePillars,
  bayesianRatingScore,
  levelFromScore,
  publishEvidence,
  redistributeWeights,
  type PillarInput
} from "./trust-score.util";

describe("trust-score.util", () => {
  describe("TRUST_PILLAR_WEIGHTS", () => {
    it.each(Object.entries(TRUST_PILLAR_WEIGHTS))(
      "somme des poids = 1 pour %s",
      (_profile, weights) => {
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      }
    );
  });

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

    it("un seul avis 1/5 ne tombe pas en orageux (prior bayésien)", () => {
      const score = bayesianRatingScore([1]);
      expect(score).not.toBeNull();
      // (5*3.5 + 1) / 6 = 3.083 → ~62
      expect(score!).toBeGreaterThanOrEqual(55);
      expect(levelFromScore(score!, false)).not.toBe(TrustScoreLevel.orageux);
    });

    it("avis orageux à poids 0.5 pèse moins qu'un avis normal", () => {
      const full = bayesianRatingScore([1], [1]);
      const half = bayesianRatingScore([1], [0.5]);
      expect(full).not.toBeNull();
      expect(half).not.toBeNull();
      expect(half!).toBeGreaterThan(full!);
    });

    it("retourne null sans avis", () => {
      expect(bayesianRatingScore([])).toBeNull();
    });
  });

  describe("publishEvidence", () => {
    it("masque la preuve sous le seuil d'échantillon", () => {
      const evidence = { kind: "ratio" as const, good: 1, total: 1 };
      expect(publishEvidence(evidence, 1, 5)).toBeNull();
      expect(publishEvidence(evidence, 5, 5)).toEqual(evidence);
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

    it("profil sans aucun avis : poids ratings redistribué, pas de malus", () => {
      const pillars: PillarInput[] = [
        {
          key: "ratings",
          score: null,
          weight: 0.5,
          sampleSize: 0,
          hasData: false
        },
        {
          key: "followUpActivity",
          score: 80,
          weight: 0.3,
          sampleSize: 8,
          hasData: true
        },
        {
          key: "regularity",
          score: 70,
          weight: 0.2,
          sampleSize: 6,
          hasData: true
        }
      ];
      const agg = aggregatePillars(pillars, {
        userCreatedAt: new Date(Date.now() - 90 * 86_400_000),
        transactionCount: 10
      });
      expect(agg.isNew).toBe(false);
      // 80*0.3/0.5 + 70*0.2/0.5 = 48 + 28 = 76
      expect(agg.score).toBe(76);
      expect(agg.level).not.toBe(TrustScoreLevel.orageux);
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
      const recent = bayesianRatingScore([5, 5, 5, 5, 5]);
      const sameCumulative = bayesianRatingScore([5, 5, 5, 5, 5]);
      expect(recent).toBe(sameCumulative);
    });
  });
});
