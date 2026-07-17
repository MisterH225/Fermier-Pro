import {
  computeHealthRates,
  computeLifecycleRates,
  computeReproductionRates,
  incidencePerThousand,
  mergeExitsByKind,
  mergeWeightedAvg,
  normalizeDiagnosis,
  safeRate
} from "./region-stats-p28.util";

describe("region-stats-p28.util", () => {
  describe("normalizeDiagnosis", () => {
    it("normalise casse et espaces (évite PPA/ppa)", () => {
      expect(normalizeDiagnosis("  PPA ")).toBe("ppa");
      expect(normalizeDiagnosis("ppa")).toBe("ppa");
      expect(normalizeDiagnosis("Fièvre  porcine")).toBe("fievre porcine");
    });
  });

  describe("safeRate / incidence", () => {
    it("calcule un taux depuis numérateur/dénominateur", () => {
      expect(safeRate(2, 10)).toBe(0.2);
      expect(safeRate(1, 0)).toBeNull();
    });

    it("incidence /1 000", () => {
      expect(incidencePerThousand(5, 1000)).toBe(5);
      expect(incidencePerThousand(2, 500)).toBe(4);
    });
  });

  describe("moyennes pondérées multi-départements", () => {
    it("fusionne deux moyennes avec effectifs", () => {
      const m = mergeWeightedAvg(10, 2, 20, 2);
      expect(m.avg).toBe(15);
      expect(m.count).toBe(4);
    });

    it("agrège exitsByKind", () => {
      const out = mergeExitsByKind(
        { sale: { headcount: 3, totalWeightKg: 30, totalPriceXof: 300 } },
        { sale: { headcount: 2, totalWeightKg: 20, totalPriceXof: 200 } }
      );
      expect(out.sale.headcount).toBe(5);
      expect(out.sale.totalWeightKg).toBe(50);
    });
  });

  describe("taux reproduction", () => {
    it("taux mort-nés et pertes gestation depuis comptes bruts", () => {
      const rates = computeReproductionRates({
        littersCount: 2,
        bornAlive: 18,
        stillborn: 2,
        mummifiedTotal: 0,
        weanedEstimate: 16,
        gestationsCompleted: 8,
        gestationsAborted: 1,
        gestationsLost: 1,
        matingsNatural: 6,
        matingsAI: 4,
        activeSowsCount: 10,
        farrowingIntervalSumDays: 300,
        farrowingIntervalCount: 2,
        gestationNumberSum: 6,
        gestationNumberCount: 2
      });
      expect(rates.tauxMortNes).toBe(0.1);
      expect(rates.tauxPertesGestation).toBe(0.2);
      expect(rates.tauxMiseBas).toBe(0.8);
      expect(rates.partIA).toBe(0.4);
    });
  });

  describe("santé", () => {
    it("classe par incidence et étiquette létalité déclarative", () => {
      const rates = computeHealthRates({
        diseaseSuspicionsByDiagnosis: { ppa: 10, grippe: 2 },
        mortalityByCause: { disease: 3 },
        herdCountForIncidence: 1000,
        mortalityHeadcount: 3
      });
      expect(rates.totalSuspicionsDeclared).toBe(12);
      expect(rates.incidencePerThousand).toBe(12);
      expect(rates.suspicionsByDiagnosis[0].diagnosis).toBe("ppa");
      expect(rates.letaliteApparenteDeclarative).toBe(0.25);
    });
  });

  describe("lifecycle", () => {
    it("taux vente = sorties vente ÷ effectif", () => {
      const rates = computeLifecycleRates({
        exitsByKind: {
          sale: { headcount: 20, totalWeightKg: 0, totalPriceXof: 0 }
        },
        herdCountForIncidence: 100,
        avgAgeAtSaleDays: 120,
        avgAgeAtSlaughterDays: null,
        avgAgeAtDeathDays: null,
        avgFatteningDurationDays: 90,
        sowCullsCount: 2,
        activeSowsCount: 10,
        mortalityHeadcount: 0
      });
      expect(rates.tauxVenteCheptel).toBe(0.2);
      expect(rates.tauxReformeTruies).toBe(0.2);
    });
  });
});
