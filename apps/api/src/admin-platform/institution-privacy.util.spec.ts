import {
  assertNoNominativeFields,
  maskLowHealthMapZones,
  suppressLowCells
} from "./institution-privacy.util";

describe("institution-privacy.util", () => {
  describe("suppressLowCells", () => {
    it("masque une maille sous le seuil sans valeurs chiffrées métier", () => {
      const rows = [
        {
          departmentCode: "CI-AB",
          farmCount: 3,
          mortalityHeadcount: 12,
          mortalityByCause: { infection: 12 }
        },
        {
          departmentCode: "CI-BK",
          farmCount: 8,
          mortalityHeadcount: 4,
          mortalityByCause: { accident: 4 }
        }
      ];

      const out = suppressLowCells(rows, 5);
      expect(out[0]).toEqual({
        departmentCode: "CI-AB",
        farmCount: 3,
        masked: true
      });
      expect(out[0]).not.toHaveProperty("mortalityHeadcount");
      expect(out[1]).toMatchObject({
        departmentCode: "CI-BK",
        farmCount: 8,
        mortalityHeadcount: 4
      });
    });

    it("laisse passer une maille au-dessus du seuil", () => {
      const rows = [
        {
          departmentCode: "CI-DEP-BEOUMI",
          farmCount: 5,
          vetConsultationsCount: 2
        }
      ];
      const out = suppressLowCells(rows);
      expect(out[0]).toEqual({
        departmentCode: "CI-DEP-BEOUMI",
        farmCount: 5,
        vetConsultationsCount: 2
      });
    });
  });

  describe("assertNoNominativeFields", () => {
    it("accepte un payload agrégé sans identifiant de ferme", () => {
      expect(() =>
        assertNoNominativeFields({
          coverage: { farmCount: 10, animalCount: 100, departmentsCovered: 2 },
          departments: [{ departmentCode: "CI-AB", farmCount: 6 }]
        })
      ).not.toThrow();
    });

    it("rejette un champ nominatif", () => {
      expect(() =>
        assertNoNominativeFields({
          departments: [{ departmentCode: "CI-AB", farmId: "farm-1" }]
        })
      ).toThrow(/Champ nominatif interdit/);
    });

    it("détecte latitude/longitude imbriqués", () => {
      expect(() =>
        assertNoNominativeFields({
          point: { latitude: 5.3, longitude: -4.0 }
        })
      ).toThrow(/latitude/);
    });
  });

  describe("maskLowHealthMapZones", () => {
    it("masque une zone sous le seuil sans compteurs métier", () => {
      const out = maskLowHealthMapZones([
        {
          zoneId: "department:CI-LOW",
          label: "Zone faible",
          level: "department",
          farmsAffectedCount: 3,
          casesCount: 8,
          activeCasesCount: 2,
          dominantDiagnoses: [{ name: "PPC", count: 2 }],
          centerLat: 5.3,
          centerLng: -4.0
        },
        {
          zoneId: "department:CI-HIGH",
          label: "Zone forte",
          level: "department",
          farmsAffectedCount: 6,
          casesCount: 12,
          activeCasesCount: 4,
          dominantDiagnoses: [{ name: "Rouget", count: 4 }],
          centerLat: 6.1,
          centerLng: -5.2
        }
      ]);
      expect(out[0]).toEqual({
        zoneId: "department:CI-LOW",
        label: "Zone faible",
        level: "department",
        masked: true
      });
      expect(out[0]).not.toHaveProperty("casesCount");
      expect(out[1]).toMatchObject({
        zoneId: "department:CI-HIGH",
        farmsAffectedCount: 6,
        casesCount: 12
      });
    });
  });
});
