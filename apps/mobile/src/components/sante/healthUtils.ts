import type { EventItem } from "../lists";
import type { FarmHealthRecordRowDto, FarmHealthRecordKind } from "../../lib/api";

export const DISEASE_STATUSES = [
  "active",
  "recovered",
  "dead",
  "slaughtered"
] as const;

export const MORTALITY_CAUSES = [
  "disease",
  "accident",
  "unknown",
  "other"
] as const;

export const HEALTH_KIND_TABS = [
  "vaccination",
  "disease",
  "vet_visit",
  "treatment",
  "mortality"
] as const;

/** Types enregistrables via le modal générique (hors maladie — DiseaseModal dédié). */
export const HEALTH_RECORD_ADD_KINDS = [
  "vaccination",
  "vet_visit",
  "treatment",
  "mortality"
] as const;

export type HealthKindTab = (typeof HEALTH_KIND_TABS)[number];
export type HealthScreenTab = "overview" | HealthKindTab;

export type DiseaseFilterId = "all" | "active" | "resolved" | "chronic";
export type TreatmentFilterId = "ongoing" | "completed" | "all";

export const MORTALITY_WARN_PCT = 3;

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatHealthDay(iso: string, locale: string): string {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) {
    return "—";
  }
  return x.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function healthPrimaryTitle(r: FarmHealthRecordRowDto): string {
  if (r.kind === "vaccination" && r.vaccination) {
    return r.vaccination.vaccineName;
  }
  if (r.kind === "disease" && r.disease) {
    return r.disease.diagnosis ?? r.disease.caseStatus;
  }
  if (r.kind === "vet_visit" && r.vetVisit) {
    return `${r.vetVisit.vetName} · ${r.vetVisit.reason}`;
  }
  if (r.kind === "treatment" && r.treatment) {
    return r.treatment.drugName;
  }
  if (r.kind === "mortality" && r.mortality) {
    return r.mortality.cause;
  }
  return r.kind;
}

export function healthCostParts(
  r: FarmHealthRecordRowDto
): Pick<EventItem, "value" | "valueType"> {
  if (r.kind === "vet_visit" && r.vetVisit?.cost != null && String(r.vetVisit.cost).length) {
    const n =
      typeof r.vetVisit.cost === "number"
        ? r.vetVisit.cost
        : Number.parseFloat(String(r.vetVisit.cost).replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      return { value: `- ${n.toLocaleString("fr-FR")} FCFA`, valueType: "negative" };
    }
  }
  if (r.kind === "treatment" && r.treatment?.cost != null && String(r.treatment.cost).length) {
    const n =
      typeof r.treatment.cost === "number"
        ? r.treatment.cost
        : Number.parseFloat(String(r.treatment.cost).replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      return { value: `- ${n.toLocaleString("fr-FR")} FCFA`, valueType: "negative" };
    }
  }
  return { valueType: "neutral" };
}

export function healthListIcon(r: FarmHealthRecordRowDto): EventItem["iconType"] {
  if (r.kind === "vaccination" || r.kind === "treatment") {
    return "in";
  }
  if (r.kind === "mortality") {
    return "out";
  }
  if (r.kind === "disease") {
    return "custom";
  }
  return "check";
}

export function matchesDiseaseFilter(
  r: FarmHealthRecordRowDto,
  filter: DiseaseFilterId
): boolean {
  if (r.kind !== "disease" || !r.disease) {
    return false;
  }
  const status = r.disease.caseStatus;
  if (filter === "all") {
    return true;
  }
  if (filter === "active") {
    return status === "active";
  }
  if (filter === "resolved") {
    return status === "recovered";
  }
  if (filter === "chronic") {
    if (status !== "active") {
      return false;
    }
    const days =
      (Date.now() - new Date(r.occurredAt).getTime()) / (24 * 60 * 60 * 1000);
    return days >= 30;
  }
  return true;
}

export function matchesTreatmentFilter(
  r: FarmHealthRecordRowDto,
  filter: TreatmentFilterId
): boolean {
  if (r.kind !== "treatment" || !r.treatment) {
    return false;
  }
  if (filter === "all") {
    return true;
  }
  const end = r.treatment.endDate ? new Date(r.treatment.endDate) : null;
  const ongoing = !end || end.getTime() >= Date.now();
  return filter === "ongoing" ? ongoing : !ongoing;
}

export function recordToEventItem(
  r: FarmHealthRecordRowDto,
  locale: string,
  kindLabel: string
): EventItem {
  const date = formatHealthDay(r.occurredAt, locale);
  const title = healthPrimaryTitle(r);
  let subtitle = `${kindLabel} · ${r.entityType} ${r.entityId.slice(0, 8)}…`;
  if (r.kind === "disease" && r.disease) {
    subtitle = `${r.disease.caseStatus} · ${subtitle}`;
  }
  if (r.kind === "treatment" && r.treatment?.endDate) {
    subtitle = `${formatHealthDay(r.treatment.endDate, locale)} · ${subtitle}`;
  }
  const cost = healthCostParts(r);
  const iconType = healthListIcon(r);
  return {
    id: r.id,
    title,
    subtitle,
    value: cost.value,
    valueType: cost.valueType,
    date,
    iconType,
    customIcon: iconType === "custom" ? "medkit-outline" : undefined,
    meta: r
  };
}

export function healthKindSectionTitle(
  kind: HealthKindTab,
  t: (k: string) => string
): string {
  switch (kind) {
    case "vaccination":
      return t("health.sectionVaccinations");
    case "disease":
      return t("health.sectionDiseases");
    case "vet_visit":
      return t("health.sectionVet");
    case "treatment":
      return t("health.sectionTreatments");
    case "mortality":
      return t("health.sectionMortalities");
  }
}

export function healthKindShortLabel(
  kind: FarmHealthRecordKind,
  t: (k: string) => string
): string {
  switch (kind) {
    case "vaccination":
      return t("health.pillVaccination");
    case "disease":
      return t("health.pillDisease");
    case "vet_visit":
      return t("health.pillVet");
    case "treatment":
      return t("health.pillTreatment");
    case "mortality":
      return t("health.pillMortality");
    default:
      return kind;
  }
}
