import type { EventItem } from "../../lists";
import type {
  AnimalListItem,
  FarmDiseaseHistoryRowDto,
  FarmHealthRecordRowDto
} from "../../../lib/api";
import { animalDisplayTag } from "../../cheptel/animals/animalUtils";
import { formatHealthDay } from "../healthUtils";

export function diseaseDurationDays(
  occurredAt: string,
  resolvedAt?: string | null
): number {
  const start = new Date(occurredAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
}

export function diseaseDurationLabel(
  days: number,
  t: (k: string, opts?: { count?: number }) => string
): string {
  if (days <= 1) {
    return t("health.diseases.durationDay", { count: 1 });
  }
  return t("health.diseases.durationDays", { count: days });
}

export function diseaseSeverityColor(severity?: string | null): string {
  if (severity === "severe") {
    return "#DC2626";
  }
  if (severity === "moderate") {
    return "#F97316";
  }
  if (severity === "mild") {
    return "#22C55E";
  }
  return "#64748B";
}

export function diseaseDiagnosisLabel(record: FarmHealthRecordRowDto): string {
  const tags = (record.disease?.symptoms as { tags?: string[] } | null)?.tags;
  return (
    record.disease?.diagnosis?.trim() ||
    (Array.isArray(tags) ? tags[0] : undefined) ||
    "—"
  );
}

export function activeCaseToEventItem(
  r: FarmHealthRecordRowDto,
  animals: AnimalListItem[],
  locale: string,
  t: (k: string, opts?: { count?: number }) => string
): EventItem {
  const animal = animals.find((a) => a.id === r.entityId);
  const tags = (r.disease?.symptoms as { tags?: string[] } | null)?.tags ?? [];
  const days = diseaseDurationDays(r.occurredAt);
  const duration = diseaseDurationLabel(days, t);
  const sev = r.disease?.severity;

  return {
    id: r.id,
    title: animal ? animalDisplayTag(animal) : r.entityId.slice(0, 8),
    subtitle: [
      animal?.currentPen?.penName,
      tags.slice(0, 3).join(", ") || r.disease?.diagnosis,
      duration
    ]
      .filter(Boolean)
      .join(" · "),
    date: formatHealthDay(r.occurredAt, locale),
    iconType: "custom",
    customIcon: "medkit-outline",
    iconColor: diseaseSeverityColor(sev),
    value: r.disease?.treatmentOngoing
      ? t("health.caseDetail.treatmentYes")
      : sev === "severe"
        ? t("health.diseaseModal.severitySevere")
        : sev === "moderate"
          ? t("health.diseaseModal.severityModerate")
          : sev === "mild"
            ? t("health.diseaseModal.severityMild")
            : undefined,
    valueType: r.disease?.inIsolation ? "negative" : "neutral",
    meta: r
  };
}

export function historyRowToEventItem(
  row: FarmDiseaseHistoryRowDto,
  animals: AnimalListItem[],
  locale: string,
  t: (k: string, opts?: { count?: number }) => string
): EventItem {
  const animal = animals.find((a) => a.id === row.entityId);
  const diagnosis = diseaseDiagnosisLabel(row);
  const duration = diseaseDurationLabel(row.durationDays, t);
  const resolved = row.disease?.resolvedAt ?? row.occurredAt;

  return {
    id: row.id,
    title: animal ? animalDisplayTag(animal) : row.entityId.slice(0, 8),
    subtitle: [
      diagnosis,
      duration,
      row.treatmentLabel
        ? `${t("health.diseases.historyTreatment")}: ${row.treatmentLabel}`
        : null
    ]
      .filter(Boolean)
      .join(" · "),
    date: formatHealthDay(resolved, locale),
    iconType: "check",
    value:
      row.disease?.caseStatus === "dead"
        ? t("health.diseases.historyDead")
        : t("health.diseases.historyRecovered"),
    valueType: row.disease?.caseStatus === "dead" ? "negative" : "positive",
    meta: row
  };
}
