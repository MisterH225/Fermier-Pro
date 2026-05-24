import type { AnimalListItem, PenAnimalRowDto } from "../../../lib/api";
import type { EventItem } from "../../lists/types";

export type AnimalStatusKey =
  | "active"
  | "dead"
  | "sold"
  | "reformed"
  | "transferred";

export type AnimalFilterId =
  | "all"
  | "male"
  | "female"
  | "active"
  | "sold"
  | "dead"
  | "reformed";

export function animalDisplayTag(a: AnimalListItem): string {
  const tag = a.tagCode?.trim();
  if (tag) {
    return tag;
  }
  return `FP-${a.id.slice(-6).toUpperCase()}`;
}

/** Convertit une ligne de loge en item liste (fiche animal). */
export function penAnimalToListItem(
  a: PenAnimalRowDto,
  pen?: { id: string; name: string; barnId: string; barnName: string } | null
): AnimalListItem {
  return {
    id: a.id,
    publicId: a.publicId,
    tagCode: a.tagCode,
    sex: a.sex,
    productionCategory: a.productionCategory,
    status: a.status,
    healthStatus: a.healthStatus,
    species: a.species,
    breed: a.breed,
    weights: a.weights.map((w) => ({
      weightKg: w.weightKg,
      measuredAt: w.measuredAt
    })),
    currentPen: pen
      ? {
          placementId: "",
          penId: pen.id,
          penName: pen.name,
          barnId: pen.barnId,
          barnName: pen.barnName
        }
      : null
  };
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
    return "#2563EB";
  }
  if (sex === "female") {
    return "#DB2777";
  }
  return "#6B7280";
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

export function filterAnimals(
  animals: AnimalListItem[],
  filterId: AnimalFilterId,
  search: string
): AnimalListItem[] {
  let list = animals;
  switch (filterId) {
    case "male":
      list = list.filter((a) => a.sex === "male");
      break;
    case "female":
      list = list.filter((a) => a.sex === "female");
      break;
    case "active":
      list = list.filter((a) => a.status === "active");
      break;
    case "sold":
      list = list.filter((a) => a.status === "sold");
      break;
    case "dead":
      list = list.filter((a) => a.status === "dead");
      break;
    case "reformed":
      list = list.filter((a) => a.status === "reformed");
      break;
    default:
      break;
  }
  const q = search.trim().toLowerCase();
  if (!q) {
    return list;
  }
  return list.filter((a) => {
    const tag = animalDisplayTag(a).toLowerCase();
    const breed = a.breed?.name?.toLowerCase() ?? "";
    const pen = a.currentPen?.penName?.toLowerCase() ?? "";
    return tag.includes(q) || breed.includes(q) || pen.includes(q);
  });
}

export function animalToEventItem(
  a: AnimalListItem,
  labels: {
    status: (s: string) => string;
    noPen: string;
    penLine: (barn: string, pen: string) => string;
  }
): EventItem {
  const tag = animalDisplayTag(a);
  const w = a.weights[0];
  const penLabel = a.currentPen
    ? labels.penLine(a.currentPen.barnName, a.currentPen.penName)
    : labels.noPen;
  const breed = a.breed?.name ?? "—";
  return {
    id: a.id,
    title: tag,
    subtitle: `${breed} · ${penLabel}`,
    value: formatAnimalKg(w?.weightKg),
    valueType: statusTone(a.status),
    date: labels.status(a.status),
    iconType: "custom",
    customIcon: sexIconName(a.sex),
    iconColor: sexIconColor(a.sex),
    meta: a
  };
}

export function suggestNextTagCode(animals: AnimalListItem[]): string {
  const prefix = "PORC";
  let max = 0;
  for (const a of animals) {
    const tag = a.tagCode?.trim();
    if (!tag) {
      continue;
    }
    const m = new RegExp(`^${prefix}-(\\d+)$`, "i").exec(tag);
    if (m) {
      max = Math.max(max, Number.parseInt(m[1], 10));
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
