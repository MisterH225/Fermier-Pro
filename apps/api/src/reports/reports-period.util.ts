import { BadRequestException } from "@nestjs/common";
import type { ReportPeriodType } from "@prisma/client";

export type PeriodAnchor = {
  year: number;
  /** 1–12 (mois calendaire) */
  month?: number;
  /** 1–4 */
  quarter?: number;
};

export function resolveReportPeriod(
  periodType: ReportPeriodType,
  anchor: PeriodAnchor
): { start: Date; end: Date } {
  const y = anchor.year;
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new BadRequestException("year invalide");
  }
  if (periodType === "monthly") {
    const m = anchor.month ?? 1;
    if (m < 1 || m > 12) {
      throw new BadRequestException("month invalide (1-12)");
    }
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    return { start, end };
  }
  if (periodType === "quarterly") {
    const q = anchor.quarter ?? 1;
    if (q < 1 || q > 4) {
      throw new BadRequestException("quarter invalide (1-4)");
    }
    const m0 = (q - 1) * 3;
    const start = new Date(Date.UTC(y, m0, 1));
    const end = new Date(Date.UTC(y, m0 + 3, 1));
    return { start, end };
  }
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y + 1, 0, 1));
  return { start, end };
}

export function previousPeriod(
  periodType: ReportPeriodType,
  start: Date,
  end: Date
): { start: Date; end: Date } {
  const ms = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - ms);
  return { start: prevStart, end: prevEnd };
}
