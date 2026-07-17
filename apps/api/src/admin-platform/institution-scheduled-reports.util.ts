import {
  INSTITUTION_STAT_SECTIONS,
  type InstitutionStatSection
} from "./institution-stats-sections.constants";
import type { InstitutionScheduledReportsConfig } from "./institution-report.constants";

export function parseScheduledReportsConfig(
  raw: unknown
): InstitutionScheduledReportsConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const input = raw as Record<string, unknown>;
  const cadence = input.cadence === "weekly" ? "weekly" : "monthly";
  const format = input.format === "csv" ? "csv" : "pdf";
  const sections: InstitutionStatSection[] = [];
  if (Array.isArray(input.sections)) {
    for (const key of input.sections) {
      if (
        typeof key === "string" &&
        (INSTITUTION_STAT_SECTIONS as readonly string[]).includes(key) &&
        key !== "movements"
      ) {
        sections.push(key as InstitutionStatSection);
      }
    }
  }
  const lastRunAt =
    typeof input.lastRunAt === "string" ? input.lastRunAt : undefined;
  return {
    isActive: input.isActive === true,
    cadence,
    format,
    sections,
    ...(lastRunAt ? { lastRunAt } : {})
  };
}

export function sanitizeScheduledReportsConfig(
  input?: Partial<InstitutionScheduledReportsConfig> | null
): InstitutionScheduledReportsConfig {
  const parsed = parseScheduledReportsConfig(input ?? {});
  return (
    parsed ?? {
      isActive: false,
      cadence: "monthly",
      format: "pdf",
      sections: []
    }
  );
}

/** Détermine si un rapport programmé doit être généré pour la période courante. */
export function shouldRunScheduledReport(
  config: InstitutionScheduledReportsConfig,
  now: Date = new Date()
): boolean {
  if (!config.isActive || config.sections.length === 0) {
    return false;
  }
  if (!config.lastRunAt) {
    return true;
  }
  const last = new Date(config.lastRunAt);
  if (Number.isNaN(last.getTime())) {
    return true;
  }
  if (config.cadence === "weekly") {
    const weekStart = startOfUtcWeek(now);
    return last < weekStart;
  }
  return (
    last.getUTCFullYear() < now.getUTCFullYear() ||
    last.getUTCMonth() < now.getUTCMonth()
  );
}

function startOfUtcWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function previousPeriodRange(
  cadence: "monthly" | "weekly",
  now: Date = new Date()
): { from: string; to: string } {
  if (cadence === "weekly") {
    const end = startOfUtcWeek(now);
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10)
    };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}
