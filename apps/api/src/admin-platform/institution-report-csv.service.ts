import { Injectable } from "@nestjs/common";
import archiver from "archiver";
import Papa from "papaparse";
import { PassThrough } from "node:stream";
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import type { InstitutionReportSectionData } from "./institution-report.constants";
import {
  labelProductionCategory,
  reportI18n,
  type ReportLocale
} from "./institution-report.i18n";
import { sectionChartAnalyses } from "./institution-report-section-charts";
import { institutionReportSectionFilename } from "./institution-report-pdf.template";

function isMasked(row: Record<string, unknown>): boolean {
  return row.masked === true;
}

function cell(
  value: unknown,
  masked: boolean,
  maskedLabel: string,
  locale?: ReportLocale,
  translateCategoryKeys = false
): string | number {
  if (masked) {
    return maskedLabel;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, number>)
      .map(([k, v]) => {
        const key =
          translateCategoryKeys && locale
            ? labelProductionCategory(k, locale)
            : k;
        return `${key}:${v}`;
      })
      .join(";");
  }
  return value == null ? "" : String(value);
}

function sectionToRows(
  section: InstitutionStatSection,
  departments: Record<string, unknown>[],
  locale: ReportLocale
): Record<string, string | number>[] {
  const maskedLabel = reportI18n(locale).common.maskedCell;
  return departments.map((row) => {
    const masked = isMasked(row);
    const base = {
      departmentCode: String(row.departmentCode ?? ""),
      farmCount: cell(row.farmCount, masked, maskedLabel)
    };
    switch (section) {
      case "mortality":
        return {
          ...base,
          mortalityHeadcount: cell(
            row.mortalityHeadcount,
            masked,
            maskedLabel
          ),
          mortalityByCause: cell(row.mortalityByCause, masked, maskedLabel),
          zScore: cell(row.zScore, masked, maskedLabel)
        };
      case "herd":
        return {
          ...base,
          animalCountByCategory: cell(
            row.animalCountByCategory,
            masked,
            maskedLabel,
            locale,
            true
          ),
          exitsSaleHeadcount: cell(
            row.exitsSaleHeadcount,
            masked,
            maskedLabel
          ),
          exitsSlaughterHeadcount: cell(
            row.exitsSlaughterHeadcount,
            masked,
            maskedLabel
          )
        };
      case "reproduction":
        return {
          ...base,
          littersCount: cell(row.littersCount, masked, maskedLabel),
          bornAlive: cell(row.bornAlive, masked, maskedLabel),
          stillborn: cell(row.stillborn, masked, maskedLabel),
          weanedEstimate: cell(row.weanedEstimate, masked, maskedLabel)
        };
      case "growth":
        return {
          ...base,
          avgGmqByCategory: cell(
            row.avgGmqByCategory,
            masked,
            maskedLabel,
            locale,
            true
          ),
          exitsSaleAvgPricePerKg: cell(
            row.exitsSaleAvgPricePerKg,
            masked,
            maskedLabel
          )
        };
      case "vetCoverage":
        return {
          ...base,
          vetConsultationsCount: cell(
            row.vetConsultationsCount,
            masked,
            maskedLabel
          )
        };
      case "economy":
        return {
          ...base,
          exitsSaleHeadcount: cell(
            row.exitsSaleHeadcount,
            masked,
            maskedLabel
          ),
          exitsSaleAvgPricePerKg: cell(
            row.exitsSaleAvgPricePerKg,
            masked,
            maskedLabel
          ),
          exitsSlaughterHeadcount: cell(
            row.exitsSlaughterHeadcount,
            masked,
            maskedLabel
          )
        };
      case "health":
        return {
          ...base,
          totalSuspicionsDeclared: cell(
            row.totalSuspicionsDeclared,
            masked,
            maskedLabel
          ),
          incidencePerThousand: cell(
            row.incidencePerThousand,
            masked,
            maskedLabel
          ),
          letaliteApparenteDeclarative: cell(
            row.letaliteApparenteDeclarative,
            masked,
            maskedLabel
          ),
          mortalityByCause: cell(row.mortalityByCause, masked, maskedLabel)
        };
      case "lifecycle":
        return {
          ...base,
          tauxVenteCheptel: cell(row.tauxVenteCheptel, masked, maskedLabel),
          tauxMortaliteGlobal: cell(
            row.tauxMortaliteGlobal,
            masked,
            maskedLabel
          ),
          tauxReformeTruies: cell(row.tauxReformeTruies, masked, maskedLabel),
          avgAgeAtSaleDays: cell(row.avgAgeAtSaleDays, masked, maskedLabel),
          avgFatteningDurationDays: cell(
            row.avgFatteningDurationDays,
            masked,
            maskedLabel
          )
        };
      case "adoption":
        return {
          ...base,
          activeFarmsCount: cell(row.activeFarmsCount, masked, maskedLabel),
          activeUsersByRole: cell(row.activeUsersByRole, masked, maskedLabel)
        };
      default:
        return base;
    }
  });
}

/** Séries utilisées par les graphiques PDF — pour réutilisation / Excel. */
function sectionChartSeries(
  section: InstitutionReportSectionData,
  locale: ReportLocale
): Record<string, string | number>[] {
  const maskedLabel = reportI18n(locale).common.maskedCell;
  const label =
    reportI18n(locale).common.sectionLabels[section.section] ?? section.section;
  const rows = section.departments.filter((r) => r.masked !== true);
  return rows.map((row) => {
    const base = {
      section: section.section,
      chart: "department_primary",
      departmentCode: String(row.departmentCode ?? ""),
      label
    };
    switch (section.section) {
      case "mortality":
        return {
          ...base,
          value: cell(row.mortalityHeadcount, false, maskedLabel)
        };
      case "reproduction":
        return { ...base, value: cell(row.bornAlive, false, maskedLabel) };
      case "health":
        return {
          ...base,
          value: cell(row.incidencePerThousand, false, maskedLabel)
        };
      case "lifecycle":
        return {
          ...base,
          value: cell(row.tauxVenteCheptel, false, maskedLabel)
        };
      case "adoption":
        return {
          ...base,
          value: cell(row.activeFarmsCount, false, maskedLabel)
        };
      case "vetCoverage":
        return {
          ...base,
          value: cell(row.vetConsultationsCount, false, maskedLabel)
        };
      case "economy":
        return {
          ...base,
          value: cell(row.exitsSaleHeadcount, false, maskedLabel)
        };
      case "growth":
        return {
          ...base,
          value: cell(row.exitsSaleAvgPricePerKg, false, maskedLabel)
        };
      case "herd":
        return { ...base, value: cell(row.farmCount, false, maskedLabel) };
      default:
        return { ...base, value: cell(row.farmCount, false, maskedLabel) };
    }
  });
}

@Injectable()
export class InstitutionReportCsvService {
  buildSectionCsv(
    section: InstitutionReportSectionData,
    locale: ReportLocale = "fr"
  ): string {
    const rows = sectionToRows(section.section, section.departments, locale);
    return Papa.unparse(rows, { header: true });
  }

  async buildZip(
    sections: InstitutionReportSectionData[],
    from: string,
    to: string,
    locale: ReportLocale = "fr"
  ): Promise<Buffer> {
    const files = sections.map((section) => ({
      name: institutionReportSectionFilename(section.section, from, to),
      content: this.buildSectionCsv(section, locale)
    }));
    const chartRows = sections.flatMap((s) => sectionChartSeries(s, locale));
    if (chartRows.length > 0) {
      files.push({
        name: `visualisations_${from}_${to}.csv`,
        content: Papa.unparse(chartRows, { header: true })
      });
    }
    const analysisRows = sections.flatMap((s) =>
      sectionChartAnalyses(s, locale)
    );
    if (analysisRows.length > 0) {
      files.push({
        name: `analyses_${from}_${to}.csv`,
        content: Papa.unparse(analysisRows, { header: true })
      });
    }
    return zipFiles(files);
  }
}

async function zipFiles(
  files: Array<{ name: string; content: string }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.pipe(stream);
    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }
    void archive.finalize();
  });
}
