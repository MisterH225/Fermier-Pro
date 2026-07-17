import { describe, expect, it } from "vitest";
import {
  buildDepartmentFeatureState,
  buildStatsByDepartment,
  computeGeoJsonBounds,
  deriveDepartmentStatsFromZones,
  extractDepartmentCode,
  maxIntensityFromStats,
  resolveHealthMapMode,
  zoneMatchesDepartment
} from "./health-map-choropleth";

describe("health-map-choropleth", () => {
  it("résout le mode choroplèthe pour les stats départementales agrégées", () => {
    expect(
      resolveHealthMapMode({
        mapDataMode: "aggregated",
        granularity: "department"
      })
    ).toBe("choropleth");

    expect(
      resolveHealthMapMode({
        points: [{ id: "p1" }],
        granularity: "sector"
      })
    ).toBe("points");
  });

  it("jointe les stats par departmentCode", () => {
    const stats = buildStatsByDepartment([
      {
        departmentCode: "CI-AB",
        activeCasesCount: 12,
        farmsAffectedCount: 6
      },
      {
        departmentCode: "CI-BK",
        activeCasesCount: 0,
        farmsAffectedCount: 8
      }
    ]);

    expect(stats.get("CI-AB")?.activeCasesCount).toBe(12);
    expect(stats.get("CI-BK")?.farmsAffectedCount).toBe(8);
    expect(maxIntensityFromStats([...stats.values()], "activeCasesCount")).toBe(
      12
    );
  });

  it("distingue département sans donnée, masqué et zéro cas", () => {
    const withData = buildDepartmentFeatureState(
      {
        departmentCode: "CI-AB",
        activeCasesCount: 0,
        farmsAffectedCount: 5
      },
      "activeCasesCount"
    );
    const masked = buildDepartmentFeatureState(
      {
        departmentCode: "CI-BK",
        activeCasesCount: 9,
        farmsAffectedCount: 2,
        masked: true
      },
      "activeCasesCount"
    );
    const noData = buildDepartmentFeatureState(undefined, "activeCasesCount");

    expect(withData.hasData).toBe(true);
    expect(withData.activeCases).toBe(0);
    expect(withData.masked).toBe(false);

    expect(masked.hasData).toBe(true);
    expect(masked.masked).toBe(true);
    expect(masked.activeCases).toBe(0);

    expect(noData.hasData).toBe(false);
    expect(noData.masked).toBe(false);
  });

  it("dérive departmentStats depuis les zones API", () => {
    const stats = deriveDepartmentStatsFromZones([
      {
        id: "department:CI-AE",
        label: "Abengourou",
        level: "department",
        activeCases: 4,
        farmCount: 7,
        topDiseases: [{ name: "Peste porcine", count: 2 }]
      }
    ]);

    expect(stats).toEqual([
      {
        departmentCode: "CI-AE",
        departmentName: "Abengourou",
        activeCasesCount: 4,
        farmsAffectedCount: 7,
        dominantDiagnoses: [{ name: "Peste porcine", count: 2 }],
        masked: false
      }
    ]);
  });

  it("associe la sélection au departmentCode", () => {
    expect(extractDepartmentCode("department:CI-AB")).toBe("CI-AB");
    expect(zoneMatchesDepartment("department:CI-AB", "CI-AB")).toBe(true);
    expect(zoneMatchesDepartment("department:CI-AB", "department:CI-AB")).toBe(
      true
    );
    expect(zoneMatchesDepartment("department:CI-AB", "CI-BK")).toBe(false);
  });

  it("calcule le bbox du GeoJSON CI", () => {
    const bounds = computeGeoJsonBounds({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { departmentCode: "CI-AB" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-4, 5],
                [-3, 5],
                [-3, 6],
                [-4, 6],
                [-4, 5]
              ]
            ]
          }
        }
      ]
    });

    expect(bounds).toEqual([
      [-4, 5],
      [-3, 6]
    ]);
  });
});
