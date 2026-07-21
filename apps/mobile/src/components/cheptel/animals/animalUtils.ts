import type { AnimalListItem } from "../../../lib/api";
import { uiNamedColors } from "../../../theme/uiNamedColors";

export type AnimalStatusKey =
  | "active"
  | "dead"
  | "sold"
  | "exited"
  | "transferred";

/** Statut API canonique (legacy `reformed` → `exited`). */
export function normalizeAnimalStatusKey(status: string): AnimalStatusKey | string {
  if (status === "reformed") {
    return "exited";
  }
  return status;
}

export function animalDisplayTag(a: AnimalListItem): string {
  const tag = a.tagCode?.trim();
  if (tag) {
    return tag;
  }
  return `FP-${a.id.slice(-6).toUpperCase()}`;
}

export function formatAnimalKg(v: string | number | undefined): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return `${n.toFixed(1)} kg`;
}

export function statusTone(
  status: string
): "positive" | "negative" | "neutral" {
  if (status === "active") {
    return "positive";
  }
  if (status === "dead" || status === "sold") {
    return "negative";
  }
  return "neutral";
}

export function sexIconName(
  sex: string
): "male" | "female" | "help-circle-outline" {
  if (sex === "male") {
    return "male";
  }
  if (sex === "female") {
    return "female";
  }
  return "help-circle-outline";
}

export function sexIconColor(sex: string): string {
  if (sex === "male") {
    return uiNamedColors.c2563EB;
  }
  if (sex === "female") {
    return uiNamedColors.cDB2777;
  }
  return uiNamedColors.c6B7280;
}

export function sexDisplayLabel(
  sex: string,
  labels: { male: string; female: string; unknown: string }
): string {
  if (sex === "male") {
    return labels.male;
  }
  if (sex === "female") {
    return labels.female;
  }
  return labels.unknown;
}

/** Suggère un reclassement reproducteur après définition du sexe sur un sujet production. */
export function shouldSuggestBreederReclass(
  productionCategory: string | undefined,
  newSex: "male" | "female"
): boolean {
  if (newSex !== "male" && newSex !== "female") {
    return false;
  }
  return (
    productionCategory === "fattening" ||
    productionCategory === "starter" ||
    productionCategory === "unknown"
  );
}

export function breederCategoryForSex(
  sex: "male" | "female"
): "breeding_female" | "breeding_male" {
  return sex === "female" ? "breeding_female" : "breeding_male";
}

export type CreateAnimalCategoryKey =
  | "breeding_female"
  | "breeding_male"
  | "fattening"
  | "starter";

export function tagPrefixForCategory(
  category: CreateAnimalCategoryKey
): "Trui" | "Ver" | "Eng" | "Dem" {
  switch (category) {
    case "breeding_female":
      return "Trui";
    case "breeding_male":
      return "Ver";
    case "fattening":
      return "Eng";
    case "starter":
      return "Dem";
  }
}

export function defaultSexForCategory(
  category: CreateAnimalCategoryKey
): "male" | "female" | "unknown" {
  if (category === "breeding_female") {
    return "female";
  }
  if (category === "breeding_male") {
    return "male";
  }
  return "unknown";
}
