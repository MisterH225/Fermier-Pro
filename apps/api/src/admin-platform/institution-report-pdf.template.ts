import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import {
  INSTITUTION_REPORT_DISCLAIMER,
  INSTITUTION_STAT_SECTION_LABELS,
  MASKED_CELL_LABEL,
  type InstitutionReportSectionData
} from "./institution-report.constants";
import { buildSectionHeader } from "../reports/templates/builders";
import type { PdfContent, PdfDocumentDefinitions } from "../reports/templates/pdf-types";
import { REPORT_COLORS } from "../reports/templates/palette";
import { buildSectionCharts } from "./institution-report-section-charts";

function isMasked(row: Record<string, unknown>): boolean {
  return row.masked === true;
}

function formatJsonRecord(value: unknown, masked: boolean): string {
  if (masked || !value || typeof value !== "object" || Array.isArray(value)) {
    return MASKED_CELL_LABEL;
  }
  const entries = Object.entries(value as Record<string, number>);
  if (entries.length === 0) {
    return "—";
  }
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

function formatNumber(value: unknown, masked: boolean): string {
  if (masked) {
    return MASKED_CELL_LABEL;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "—";
}

function sectionTable(section: InstitutionStatSection, data: InstitutionReportSectionData): PdfContent {
  const headers: string[] = ["Département", "Fermes"];
  const rows: string[][] = [];

  const getRowValues = (row: Record<string, unknown>): string[] => {
    const masked = isMasked(row);
    const base = [String(row.departmentCode ?? ""), String(row.farmCount ?? "")];
    switch (section) {
      case "mortality":
        return [
          ...base,
          formatNumber(row.mortalityHeadcount, masked),
          formatJsonRecord(row.mortalityByCause, masked),
          formatNumber(row.zScore, masked)
        ];
      case "herd":
        return [
          ...base,
          formatJsonRecord(row.animalCountByCategory, masked),
          formatNumber(row.exitsSaleHeadcount, masked),
          formatNumber(row.exitsSlaughterHeadcount, masked)
        ];
      case "reproduction":
        return [
          ...base,
          formatNumber(row.littersCount, masked),
          formatNumber(row.bornAlive, masked),
          formatNumber(row.stillborn, masked),
          formatNumber(row.weanedEstimate, masked)
        ];
      case "growth":
        return [
          ...base,
          formatJsonRecord(row.avgGmqByCategory, masked),
          formatNumber(row.exitsSaleAvgPricePerKg, masked)
        ];
      case "vetCoverage":
        return [...base, formatNumber(row.vetConsultationsCount, masked)];
      case "economy":
        return [
          ...base,
          formatNumber(row.exitsSaleHeadcount, masked),
          formatNumber(row.exitsSaleAvgPricePerKg, masked),
          formatNumber(row.exitsSlaughterHeadcount, masked)
        ];
      case "health":
        return [
          ...base,
          formatNumber(row.totalSuspicionsDeclared, masked),
          formatNumber(row.incidencePerThousand, masked),
          formatNumber(row.letaliteApparenteDeclarative, masked)
        ];
      case "lifecycle":
        return [
          ...base,
          formatNumber(row.tauxVenteCheptel, masked),
          formatNumber(row.tauxMortaliteGlobal, masked),
          formatNumber(row.avgAgeAtSaleDays, masked)
        ];
      case "adoption":
        return [
          ...base,
          formatNumber(row.activeFarmsCount, masked),
          formatJsonRecord(row.activeUsersByRole, masked)
        ];
      default:
        return base;
    }
  };

  switch (section) {
    case "mortality":
      headers.push("Mortalités", "Par cause", "Z-score");
      break;
    case "herd":
      headers.push("Cheptel / cat.", "Sorties vente", "Sorties abattage");
      break;
    case "reproduction":
      headers.push("Portées", "Nés vivants", "Mort-nés", "Sevrés");
      break;
    case "growth":
      headers.push("GMQ / cat.", "Prix vente / kg");
      break;
    case "vetCoverage":
      headers.push("Consultations vét.");
      break;
    case "economy":
      headers.push("Sorties vente", "Prix / kg", "Sorties abattage");
      break;
    case "health":
      headers.push(
        "Suspicions déclarées",
        "Incidence /1 000",
        "Létalité apparente (déclarative)"
      );
      break;
    case "lifecycle":
      headers.push("Taux vente", "Taux mortalité", "Âge moyen vente (j)");
      break;
    case "adoption":
      headers.push("Fermes actives", "Utilisateurs actifs / rôle");
      break;
    default:
      break;
  }

  for (const dept of data.departments) {
    rows.push(getRowValues(dept));
  }

  const charts = buildSectionCharts(section, data);

  const content: PdfContent[] = [
    buildSectionHeader(data.label),
    {
      text: `Période : ${data.from} → ${data.to}`,
      fontSize: 9,
      color: REPORT_COLORS.greyText,
      margin: [0, 0, 0, 8]
    },
    {
      text: `${data.coverage.farmCount} fermes · ${data.coverage.animalCount} animaux · ${data.coverage.departmentsCovered} départements`,
      fontSize: 8,
      color: REPORT_COLORS.greyText,
      margin: [0, 0, 0, 10]
    },
    ...charts,
    {
      text: "Détail tabulaire",
      fontSize: 10,
      bold: true,
      color: REPORT_COLORS.accent,
      margin: [0, 4, 0, 6]
    },
    {
      table: {
        headerRows: 1,
        widths: headers.map(() => "*"),
        body: [headers, ...rows]
      },
      layout: "lightHorizontalLines",
      fontSize: 8,
      margin: [0, 0, 0, 16]
    }
  ];

  return { stack: content };
}

export function buildInstitutionStatsReportDocDefinition(input: {
  institutionLabel: string | null;
  from: string;
  to: string;
  coverage: { farmCount: number; animalCount: number; departmentsCovered: number };
  sections: InstitutionReportSectionData[];
}): PdfDocumentDefinitions {
  const label = input.institutionLabel?.trim() || "Institution partenaire";

  const cover: PdfContent[] = [
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: 515, h: 200, color: REPORT_COLORS.primary }
      ],
      margin: [0, 0, 0, 24]
    },
    {
      text: "Rapport statistiques régionales",
      fontSize: 22,
      bold: true,
      color: REPORT_COLORS.primary,
      margin: [0, 0, 0, 8]
    },
    { text: label, fontSize: 14, margin: [0, 0, 0, 4] },
    {
      text: `Période : ${input.from} → ${input.to}`,
      fontSize: 11,
      margin: [0, 0, 0, 16]
    },
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "Couverture des données", bold: true, fontSize: 11 },
                {
                  text: `${input.coverage.farmCount} fermes · ${input.coverage.animalCount} animaux · ${input.coverage.departmentsCovered} départements`,
                  fontSize: 10,
                  margin: [0, 4, 0, 0]
                }
              ],
              fillColor: REPORT_COLORS.lightBg,
              margin: 8
            }
          ]
        ]
      },
      layout: "noBorders",
      margin: [0, 0, 0, 16]
    },
    {
      text: INSTITUTION_REPORT_DISCLAIMER,
      fontSize: 9,
      italics: true,
      color: REPORT_COLORS.greyText
    },
    { text: "", pageBreak: "after" as const }
  ];

  const sectionPages = input.sections.map((sectionData, index) => {
    const block = sectionTable(sectionData.section, sectionData);
    if (index < input.sections.length - 1) {
      return block;
    }
    const stack = (block as { stack: PdfContent[] }).stack;
    return { stack };
  });

  return {
    pageSize: "A4",
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    content: [...cover, ...sectionPages],
    footer: (currentPage: number, pageCount: number) => ({
      text: `Fermier Pro — ${label} — ${currentPage}/${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: REPORT_COLORS.greyText,
      margin: [0, 8, 0, 0]
    })
  };
}

export function institutionReportSectionFilename(
  section: InstitutionStatSection,
  from: string,
  to: string
): string {
  return `${section}_${from}_${to}.csv`;
}

export { INSTITUTION_STAT_SECTION_LABELS };
