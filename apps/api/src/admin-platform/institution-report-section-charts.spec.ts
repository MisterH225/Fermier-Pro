import { buildSectionCharts } from "./institution-report-section-charts";
import type { InstitutionReportSectionData } from "./institution-report.constants";
import { labelProductionCategory } from "./institution-report.i18n";

describe("buildSectionCharts", () => {
  const base: Omit<InstitutionReportSectionData, "section" | "departments"> = {
    label: "Test",
    from: "2026-06-01",
    to: "2026-06-30",
    coverage: { farmCount: 6, animalCount: 100, departmentsCovered: 2 }
  };

  it("produit des blocs SVG et une analyse pour mortalité", () => {
    const content = buildSectionCharts(
      "mortality",
      {
        ...base,
        section: "mortality",
        departments: [
          {
            departmentCode: "CI-BG",
            farmCount: 6,
            mortalityHeadcount: 4,
            mortalityByCause: { disease: 3, accident: 1 }
          }
        ]
      },
      "fr"
    );
    const svgs = content.filter(
      (c) => typeof c === "object" && c !== null && "svg" in c
    );
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(content)).toContain("Analyse et interprétation");
    expect(JSON.stringify(content)).toContain("Plus fort");
  });

  it("localise titres et analyses en anglais", () => {
    const content = buildSectionCharts(
      "herd",
      {
        ...base,
        section: "herd",
        departments: [
          {
            departmentCode: "CI-BG",
            farmCount: 6,
            animalCountByCategory: {
              fattening: 40,
              starter: 20,
              breeding_female: 10,
              nursing: 5,
              breeding_male: 2
            }
          }
        ]
      },
      "en"
    );
    const dump = JSON.stringify(content);
    expect(dump).toContain("Analysis and interpretation");
    expect(dump).toContain("Fattening");
    expect(dump).toContain("Breeding females");
    expect(dump).not.toContain("breeding_female");
  });

  it("signale l’absence de données masquées (FR / EN)", () => {
    const fr = buildSectionCharts(
      "reproduction",
      {
        ...base,
        section: "reproduction",
        departments: [{ departmentCode: "CI-BG", farmCount: 1, masked: true }]
      },
      "fr"
    );
    const en = buildSectionCharts(
      "reproduction",
      {
        ...base,
        section: "reproduction",
        departments: [{ departmentCode: "CI-BG", farmCount: 1, masked: true }]
      },
      "en"
    );
    expect(JSON.stringify(fr)).toContain("Graphiques indisponibles");
    expect(JSON.stringify(en)).toContain("Charts unavailable");
  });
});

describe("labelProductionCategory", () => {
  it("traduit les catégories de production", () => {
    expect(labelProductionCategory("fattening", "fr")).toBe("Engraissement");
    expect(labelProductionCategory("starter", "en")).toBe("Starter");
    expect(labelProductionCategory("nursing", "fr")).toBe("Allaitement");
    expect(labelProductionCategory("breeding_male", "en")).toBe(
      "Breeding males"
    );
  });
});
