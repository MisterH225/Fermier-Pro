import { apiBaseUrl, apiGetJson, apiPostJson } from "./http";

/** Période rapport ferme (Prisma `ReportPeriodType`). */
export type FarmReportPeriodType = "monthly" | "quarterly" | "yearly";

export type FarmReportPreviewDto = {
  farmId: string;
  periodType: FarmReportPeriodType;
  period: { start: string; end: string };
  score: {
    global: number;
    band: string;
    breakdown: Record<string, { score: number; detail: string }>;
  };
  sections: Record<string, unknown>;
};

export function fetchFarmReportPreview(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params: {
    periodType: FarmReportPeriodType;
    year: number;
    month?: number;
    quarter?: number;
  }
): Promise<FarmReportPreviewDto> {
  const q = new URLSearchParams();
  q.set("periodType", params.periodType);
  q.set("year", String(params.year));
  if (params.month != null) {
    q.set("month", String(params.month));
  }
  if (params.quarter != null) {
    q.set("quarter", String(params.quarter));
  }
  return apiGetJson<FarmReportPreviewDto>(
    `/farms/${farmId}/reports/preview?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type FarmScoreDto = {
  farmId: string;
  scoreGlobal: number;
  scoreBreakdown: Record<string, { score: number; detail: string }>;
  band: string;
};

export function fetchFarmScore(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params?: { year?: number; month?: number }
): Promise<FarmScoreDto> {
  const q = new URLSearchParams();
  if (params?.year != null) {
    q.set("year", String(params.year));
  }
  if (params?.month != null) {
    q.set("month", String(params.month));
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmScoreDto>(
    `/farms/${farmId}/score${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type FarmReportListItemDto = {
  id: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  contentHash: string | null;
  pdfUrl?: string | null;
};

export function fetchFarmReportsList(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined
): Promise<FarmReportListItemDto[]> {
  return apiGetJson<FarmReportListItemDto[]>(
    `/farms/${farmId}/reports`,
    accessToken,
    activeProfileId
  );
}

export function generateFarmReport(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  body: {
    periodType: FarmReportPeriodType;
    anchor: { year: number; month?: number; quarter?: number };
  }
): Promise<{
  id: string;
  reportId?: string;
  scoreGlobal: number;
  contentHash: string;
  downloadUrl?: string | null;
}> {
  return apiPostJson(
    `/farms/${farmId}/reports/generate`,
    body,
    accessToken,
    activeProfileId
  );
}

export type FarmReportDetailDto = {
  id: string;
  farmId: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  scoreBreakdown: unknown;
  dataSnapshot: unknown;
  contentHash: string | null;
};

export function fetchFarmReportById(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<FarmReportDetailDto> {
  return apiGetJson<FarmReportDetailDto>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}`,
    accessToken,
    activeProfileId
  );
}

export function farmReportPdfAbsoluteUrl(farmId: string, reportId: string): string {
  return `${apiBaseUrl()}/api/v1/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/pdf`;
}

export function fetchFarmReportDownloadUrl(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<{ downloadUrl: string }> {
  return apiGetJson<{ downloadUrl: string }>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/download`,
    accessToken,
    activeProfileId
  );
}

