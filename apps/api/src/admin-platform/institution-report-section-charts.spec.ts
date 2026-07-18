import { buildSectionCharts } from "./institution-report-section-charts";
import type { InstitutionReportSectionData } from "./institution-report.constants";

describe("buildSectionCharts", () => {
  const base: Omit<InstitutionReportSectionData, "section" | "departments"> = {
    label: "Test",
    from: "2026-06-01",
    to: "2026-06-30",
    coverage: { farmCount: 6, animalCount: 100, departmentsCovered: 2 }
  };

  it("produit des blocs SVG pour mortalité", () => {
    const content = buildSectionCharts("mortality", {
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
    });
    const svgs = content.filter(
      (c) => typeof c === "object" && c !== null && "svg" in c
    );
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("signale l’absence de données masquées", () => {
    const content = buildSectionCharts("reproduction", {
      ...base,
      section: "reproduction",
      departments: [
        { departmentCode: "CI-BG", farmCount: 1, masked: true }
      ]
    });
    expect(JSON.stringify(content)).toContain("Graphiques indisponibles");
  });
});
