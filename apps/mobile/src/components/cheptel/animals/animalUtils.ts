import type { AnimalListItem } from "../../../lib/api";
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
  return a.tagCode?.trim() || a.publicId.slice(0, 10);
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
  const nums = animals
    .map((a) => {
      const src = a.tagCode ?? a.publicId;
      const m = /(\d+)\s*$/.exec(src);
      return m ? Number.parseInt(m[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PORC-${String(next).padStart(3, "0")}`;
}
