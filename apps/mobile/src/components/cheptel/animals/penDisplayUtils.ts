import type {
  AnimalListItem,
  PenAnimalRowDto,
  PenBatchRowDto
} from "../../../lib/api";
import type { EventItem } from "../../lists/types";
import { animalDisplayTag } from "./animalUtils";

export function batchCategoryLabel(
  categoryKey: string | null | undefined,
  t: (key: string) => string
): string {
  const k = (categoryKey ?? "").toLowerCase();
  if (
    k.includes("sous_mere") ||
    k.includes("lactation") ||
    k.includes("allaitement") ||
    k.includes("nursing")
  ) {
    return t("cheptel.pens.batchCategoryNursing");
  }
  if (
    k === "nursery" ||
    k.includes("starter") ||
    k.includes("demarrage") ||
    k.includes("porcelet")
  ) {
    return t("cheptel.pens.batchCategoryNursery");
  }
  if (k.includes("finish") || k.includes("engrais") || k === "finisher") {
    return t("cheptel.pens.batchCategoryFinisher");
  }
  return t("cheptel.pens.batchCategoryOther");
}

export function penBatchToEventItem(
  batch: PenBatchRowDto,
  t: (key: string, opts?: { count: number }) => string
): EventItem {
  return {
    id: `batch-${batch.id}`,
    title: batch.name,
    subtitle: batchCategoryLabel(batch.categoryKey, t),
    value: t("cheptel.pens.batchHeadcount", { count: batch.headcount }),
    valueType: "neutral",
    date: batch.breed?.name ?? batch.species.name,
    iconType: "custom",
    customIcon: "layers-outline",
    meta: batch
  };
}

export function penAnimalToEventItem(
  animal: PenAnimalRowDto,
  t: (key: string) => string
): EventItem {
  const lastMeasure = animal.weights[0]?.measuredAt;
  return {
    id: animal.id,
    title: animal.tagCode?.trim() || `FP-${animal.publicId.slice(-6)}`,
    subtitle: [
      animal.breed?.name,
      t(`cheptel.animals.sex.${animal.sex}`),
      animal.healthStatus === "sick" ? "🤒" : null,
      animal.activeGestation ? "🤱" : null
    ]
      .filter(Boolean)
      .join(" · "),
    value:
      animal.currentWeightKg != null ? `${animal.currentWeightKg} kg` : undefined,
    valueType:
      animal.healthStatus === "sick" || animal.vaccineOverdue
        ? "negative"
        : "neutral",
    date: lastMeasure?.slice(0, 10) ?? "—",
    iconType: "custom",
    customIcon: animal.sex === "male" ? "male-outline" : "female-outline",
    meta: animal
  };
}

/** Convertit une ligne loge en item liste (fiche animal / modals). */
export function penAnimalToListItem(
  animal: PenAnimalRowDto,
  pen?: {
    id: string;
    name: string;
    barnId: string;
    barnName: string;
  } | null
): AnimalListItem {
  return {
    id: animal.id,
    publicId: animal.publicId,
    tagCode: animal.tagCode,
    sex: animal.sex,
    productionCategory: animal.productionCategory,
    status: animal.status,
    healthStatus: animal.healthStatus,
    species: animal.species,
    breed: animal.breed,
    weights: (animal.weights ?? []).map((w) => ({
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

export function resolvePenAnimalListItem(
  penAnimal: PenAnimalRowDto,
  farmAnimals: AnimalListItem[] | undefined,
  pen?: {
    id: string;
    name: string;
    barnId: string;
    barnName: string;
  } | null
): AnimalListItem | null {
  const full = farmAnimals?.find((a) => a.id === penAnimal.id);
  if (full) {
    return full;
  }
  return penAnimalToListItem(penAnimal, pen);
}

export function penAnimalDisplayTag(animal: PenAnimalRowDto): string {
  return animalDisplayTag(penAnimalToListItem(animal));
}
