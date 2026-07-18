import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import {
  INSTITUTION_STAT_SECTION_LABELS,
  type InstitutionReportSectionData
} from "./institution-report.constants";
import {
  labelProductionCategory,
  reportI18n,
  type ReportLocale
} from "./institution-report.i18n";
import { buildSectionHeader } from "../reports/templates/builders";
import type { PdfContent, PdfDocumentDefinitions } from "../reports/templates/pdf-types";
import { REPORT_COLORS } from "../reports/templates/palette";
import { buildSectionCharts } from "./institution-report-section-charts";

function isMasked(row: Record<string, unknown>): boolean {
  return row.masked === true;
}

function formatJsonRecord(
  value: unknown,
  masked: boolean,
  maskedLabel: string,
  locale: ReportLocale,
  translateKeys: boolean
): string {
  if (masked || !value || typeof value !== "object" || Array.isArray(value)) {
    return maskedLabel;
  }
  const entries = Object.entries(value as Record<string, number>);
  if (entries.length === 0) {
    return "—";
  }
  return entries
    .map(([k, v]) => {
      const label = translateKeys ? labelProductionCategory(k, locale) : k;
      return `${label}: ${v}`;
    })
    .join(", ");
}

function formatNumber(
  value: unknown,
  masked: boolean,
  maskedLabel: string
): string {
  if (masked) {
    return maskedLabel;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "—";
}

function sectionTable(
  section: InstitutionStatSection,
  data: InstitutionReportSectionData,
  locale: ReportLocale
): PdfContent {
  const i18n = reportI18n(locale);
  const h = i18n.common.tableHeaders;
  const maskedLabel = i18n.common.maskedCell;
  const headers: string[] = [h.department, h.farms];
  const rows: string[][] = [];

  const getRowValues = (row: Record<string, unknown>): string[] => {
    const masked = isMasked(row);
    const base = [String(row.departmentCode ?? ""), String(row.farmCount ?? "")];
    switch (section) {
      case "mortality":
        return [
          ...base,
          formatNumber(row.mortalityHeadcount, masked, maskedLabel),
          formatJsonRecord(
            row.mortalityByCause,
            masked,
            maskedLabel,
            locale,
            false
          ),
          formatNumber(row.zScore, masked, maskedLabel)
        ];
      case "herd":
        return [
          ...base,
          formatJsonRecord(
            row.animalCountByCategory,
            masked,
            maskedLabel,
            locale,
            true
          ),
          formatNumber(row.exitsSaleHeadcount, masked, maskedLabel),
          formatNumber(row.exitsSlaughterHeadcount, masked, maskedLabel)
        ];
      case "reproduction":
        return [
          ...base,
          formatNumber(row.littersCount, masked, maskedLabel),
          formatNumber(row.bornAlive, masked, maskedLabel),
          formatNumber(row.stillborn, masked, maskedLabel),
          formatNumber(row.weanedEstimate, masked, maskedLabel)
        ];
      case "growth":
        return [
          ...base,
          formatJsonRecord(
            row.avgGmqByCategory,
            masked,
            maskedLabel,
            locale,
            true
          ),
          formatNumber(row.exitsSaleAvgPricePerKg, masked, maskedLabel)
        ];
      case "vetCoverage":
        return [
          ...base,
          formatNumber(row.vetConsultationsCount, masked, maskedLabel)
        ];
      case "economy":
        return [
          ...base,
          formatNumber(row.exitsSaleHeadcount, masked, maskedLabel),
          formatNumber(row.exitsSaleAvgPricePerKg, masked, maskedLabel),
          formatNumber(row.exitsSlaughterHeadcount, masked, maskedLabel)
        ];
      case "health":
        return [
          ...base,
          formatNumber(row.totalSuspicionsDeclared, masked, maskedLabel),
          formatNumber(row.incidencePerThousand, masked, maskedLabel),
          formatNumber(row.letaliteApparenteDeclarative, masked, maskedLabel)
        ];
      case "lifecycle":
        return [
          ...base,
          formatNumber(row.tauxVenteCheptel, masked, maskedLabel),
          formatNumber(row.tauxMortaliteGlobal, masked, maskedLabel),
          formatNumber(row.avgAgeAtSaleDays, masked, maskedLabel)
        ];
      case "adoption":
        return [
          ...base,
          formatNumber(row.activeFarmsCount, masked, maskedLabel),
          formatJsonRecord(
            row.activeUsersByRole,
            masked,
            maskedLabel,
            locale,
            false
          )
        ];
      default:
        return base;
    }
  };

  switch (section) {
    case "mortality":
      headers.push(h.mortality, h.byCause, h.zScore);
      break;
    case "herd":
      headers.push(h.herdByCat, h.exitsSale, h.exitsSlaughter);
      break;
    case "reproduction":
      headers.push(h.litters, h.bornAlive, h.stillborn, h.weaned);
      break;
    case "growth":
      headers.push(h.gmqByCat, h.salePrice);
      break;
    case "vetCoverage":
      headers.push(h.vetConsultations);
      break;
    case "economy":
      headers.push(h.exitsSale, h.salePrice, h.exitsSlaughter);
      break;
    case "health":
      headers.push(h.suspicions, h.incidence, h.caseFatality);
      break;
    case "lifecycle":
      headers.push(h.saleRate, h.mortalityRate, h.avgAgeSale);
      break;
    case "adoption":
      headers.push(h.activeFarms, h.usersByRole);
      break;
    default:
      break;
  }

  for (const dept of data.departments) {
    rows.push(getRowValues(dept));
  }

  const charts = buildSectionCharts(section, data, locale);

  const content: PdfContent[] = [
    buildSectionHeader(data.label),
    {
      text: i18n.common.period(data.from, data.to),
      fontSize: 9,
      color: REPORT_COLORS.greyText,
      margin: [0, 0, 0, 8]
    },
    {
      text: i18n.common.coverageLine(
        data.coverage.farmCount,
        data.coverage.animalCount,
        data.coverage.departmentsCovered
      ),
      fontSize: 8,
      color: REPORT_COLORS.greyText,
      margin: [0, 0, 0, 10]
    },
    ...charts,
    {
      text: i18n.common.tabularDetail,
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
  locale?: ReportLocale;
}): PdfDocumentDefinitions {
  const locale = input.locale ?? "fr";
  const i18n = reportI18n(locale);
  const label =
    input.institutionLabel?.trim() || i18n.common.partnerInstitution;

  const cover: PdfContent[] = [
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: 515, h: 200, color: REPORT_COLORS.primary }
      ],
      margin: [0, 0, 0, 24]
    },
    {
      text: i18n.common.reportTitle,
      fontSize: 22,
      bold: true,
      color: REPORT_COLORS.primary,
      margin: [0, 0, 0, 8]
    },
    { text: label, fontSize: 14, margin: [0, 0, 0, 4] },
    {
      text: i18n.common.period(input.from, input.to),
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
                {
                  text: i18n.common.coverageTitle,
                  bold: true,
                  fontSize: 11
                },
                {
                  text: i18n.common.coverageLine(
                    input.coverage.farmCount,
                    input.coverage.animalCount,
                    input.coverage.departmentsCovered
                  ),
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
      text: i18n.common.disclaimer,
      fontSize: 9,
      italics: true,
      color: REPORT_COLORS.greyText
    },
    { text: "", pageBreak: "after" as const }
  ];

  const sectionPages = input.sections.map((sectionData) =>
    sectionTable(sectionData.section, sectionData, locale)
  );

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
