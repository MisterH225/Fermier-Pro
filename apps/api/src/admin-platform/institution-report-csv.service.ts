import { Injectable } from "@nestjs/common";
import archiver from "archiver";
import Papa from "papaparse";
import { PassThrough } from "node:stream";
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import {
  INSTITUTION_STAT_SECTION_LABELS,
  MASKED_CELL_LABEL,
  type InstitutionReportSectionData
} from "./institution-report.constants";
import { institutionReportSectionFilename } from "./institution-report-pdf.template";

function isMasked(row: Record<string, unknown>): boolean {
  return row.masked === true;
}

function cell(value: unknown, masked: boolean): string | number {
  if (masked) {
    return MASKED_CELL_LABEL;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, number>)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }
  return value == null ? "" : String(value);
}

function sectionToRows(
  section: InstitutionStatSection,
  departments: Record<string, unknown>[]
): Record<string, string | number>[] {
  return departments.map((row) => {
    const masked = isMasked(row);
    const base = {
      departmentCode: String(row.departmentCode ?? ""),
      farmCount: cell(row.farmCount, masked)
    };
    switch (section) {
      case "mortality":
        return {
          ...base,
          mortalityHeadcount: cell(row.mortalityHeadcount, masked),
          mortalityByCause: cell(row.mortalityByCause, masked),
          zScore: cell(row.zScore, masked)
        };
      case "herd":
        return {
          ...base,
          animalCountByCategory: cell(row.animalCountByCategory, masked),
          exitsSaleHeadcount: cell(row.exitsSaleHeadcount, masked),
          exitsSlaughterHeadcount: cell(row.exitsSlaughterHeadcount, masked)
        };
      case "reproduction":
        return {
          ...base,
          littersCount: cell(row.littersCount, masked),
          bornAlive: cell(row.bornAlive, masked),
          stillborn: cell(row.stillborn, masked),
          weanedEstimate: cell(row.weanedEstimate, masked)
        };
      case "growth":
        return {
          ...base,
          avgGmqByCategory: cell(row.avgGmqByCategory, masked),
          exitsSaleAvgPricePerKg: cell(row.exitsSaleAvgPricePerKg, masked)
        };
      case "vetCoverage":
        return {
          ...base,
          vetConsultationsCount: cell(row.vetConsultationsCount, masked)
        };
      case "economy":
        return {
          ...base,
          exitsSaleHeadcount: cell(row.exitsSaleHeadcount, masked),
          exitsSaleAvgPricePerKg: cell(row.exitsSaleAvgPricePerKg, masked),
          exitsSlaughterHeadcount: cell(row.exitsSlaughterHeadcount, masked)
        };
      case "health":
        return {
          ...base,
          totalSuspicionsDeclared: cell(row.totalSuspicionsDeclared, masked),
          incidencePerThousand: cell(row.incidencePerThousand, masked),
          letaliteApparenteDeclarative: cell(
            row.letaliteApparenteDeclarative,
            masked
          ),
          mortalityByCause: cell(row.mortalityByCause, masked)
        };
      case "lifecycle":
        return {
          ...base,
          tauxVenteCheptel: cell(row.tauxVenteCheptel, masked),
          tauxMortaliteGlobal: cell(row.tauxMortaliteGlobal, masked),
          tauxReformeTruies: cell(row.tauxReformeTruies, masked),
          avgAgeAtSaleDays: cell(row.avgAgeAtSaleDays, masked),
          avgFatteningDurationDays: cell(row.avgFatteningDurationDays, masked)
        };
      case "adoption":
        return {
          ...base,
          activeFarmsCount: cell(row.activeFarmsCount, masked),
          activeUsersByRole: cell(row.activeUsersByRole, masked)
        };
      default:
        return base;
    }
  });
}

/** Séries utilisées par les graphiques PDF — pour réutilisation / Excel. */
function sectionChartSeries(
  section: InstitutionReportSectionData
): Record<string, string | number>[] {
  const rows = section.departments.filter((r) => r.masked !== true);
  return rows.map((row) => {
    const base = {
      section: section.section,
      chart: "department_primary",
      departmentCode: String(row.departmentCode ?? ""),
      label: INSTITUTION_STAT_SECTION_LABELS[section.section]
    };
    switch (section.section) {
      case "mortality":
        return { ...base, value: cell(row.mortalityHeadcount, false) };
      case "reproduction":
        return { ...base, value: cell(row.bornAlive, false) };
      case "health":
        return { ...base, value: cell(row.incidencePerThousand, false) };
      case "lifecycle":
        return { ...base, value: cell(row.tauxVenteCheptel, false) };
      case "adoption":
        return { ...base, value: cell(row.activeFarmsCount, false) };
      case "vetCoverage":
        return { ...base, value: cell(row.vetConsultationsCount, false) };
      case "economy":
        return { ...base, value: cell(row.exitsSaleHeadcount, false) };
      case "growth":
        return { ...base, value: cell(row.exitsSaleAvgPricePerKg, false) };
      case "herd":
        return { ...base, value: cell(row.farmCount, false) };
      default:
        return { ...base, value: cell(row.farmCount, false) };
    }
  });
}

@Injectable()
export class InstitutionReportCsvService {
  buildSectionCsv(section: InstitutionReportSectionData): string {
    const rows = sectionToRows(section.section, section.departments);
    return Papa.unparse(rows, { header: true });
  }

  async buildZip(
    sections: InstitutionReportSectionData[],
    from: string,
    to: string
  ): Promise<Buffer> {
    const files = sections.map((section) => ({
      name: institutionReportSectionFilename(section.section, from, to),
      content: this.buildSectionCsv(section)
    }));
    const chartRows = sections.flatMap(sectionChartSeries);
    if (chartRows.length > 0) {
      files.push({
        name: `visualisations_${from}_${to}.csv`,
        content: Papa.unparse(chartRows, { header: true })
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

export { INSTITUTION_STAT_SECTION_LABELS };
