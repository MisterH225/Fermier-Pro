import type { InstitutionStatSection } from "./institution-stats-sections.constants";

export const INSTITUTION_REPORTS_STORAGE_BUCKET =
  process.env.INSTITUTION_REPORTS_STORAGE_BUCKET?.trim() ??
  "institution-reports";

export const INSTITUTION_STAT_SECTION_LABELS: Record<
  InstitutionStatSection,
  string
> = {
  mortality: "Mortalité",
  herd: "Cheptel",
  reproduction: "Reproduction",
  growth: "Croissance",
  vetCoverage: "Couverture vétérinaire",
  economy: "Économie",
  health: "Santé (suspicions déclarées)",
  lifecycle: "Cycle de vie",
  adoption: "Adoption plateforme",
  movements: "Mouvements"
};

export const MASKED_CELL_LABEL = "données insuffisantes";

export const INSTITUTION_REPORT_DISCLAIMER =
  "Données agrégées — panel Fermier Pro, non représentatif du cheptel national";

export type InstitutionReportFormat = "pdf" | "csv";

export type InstitutionReportBuildInput = {
  institutionLabel: string | null;
  sections: InstitutionStatSection[];
  from: string;
  to: string;
  regionCode?: string;
  format: InstitutionReportFormat;
};

export type InstitutionReportSectionData = {
  section: InstitutionStatSection;
  label: string;
  from: string;
  to: string;
  coverage: {
    farmCount: number;
    animalCount: number;
    departmentsCovered: number;
  };
  departments: Record<string, unknown>[];
};

export type InstitutionReportBuildResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  storagePath?: string;
  downloadUrl?: string;
};

export type InstitutionScheduledReportsConfig = {
  isActive: boolean;
  cadence: "monthly" | "weekly";
  format: InstitutionReportFormat;
  sections: InstitutionStatSection[];
  lastRunAt?: string;
};
