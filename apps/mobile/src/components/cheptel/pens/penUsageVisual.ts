import { Ionicons } from "@expo/vector-icons";
import type { CheptelPenRowDto, PenCategoryKey, PenUsageTag } from "../../../lib/api";

type IonIcon = keyof typeof Ionicons.glyphMap;

/** Clé visuelle affichée (5 phases + états spéciaux). */
export type PenVisualKey =
  | "maternity"
  | "starter"
  | "growth"
  | "fattening"
  | "boar"
  | "quarantine"
  | "mixed"
  | "empty";

export type PenVisual = {
  key: PenVisualKey;
  bg: string;
  border: string;
  accent: string;
  iconBg: string;
  icon: IonIcon;
};

/** Poids moyen (kg) au-delà duquel une loge démarrage passe visuellement en croissance. */
const GROWTH_WEIGHT_KG = 25;
/** Âge moyen (sem.) au-delà duquel une loge démarrage passe visuellement en croissance. */
const GROWTH_AGE_WEEKS = 10;

const PEN_VISUALS: Record<PenVisualKey, PenVisual> = {
  maternity: {
    key: "maternity",
    bg: "#FDF2F8",
    border: "#F9A8D4",
    accent: "#DB2777",
    iconBg: "#FCE7F3",
    icon: "heart-outline"
  },
  starter: {
    key: "starter",
    bg: "#EFF6FF",
    border: "#93C5FD",
    accent: "#2563EB",
    iconBg: "#DBEAFE",
    icon: "egg-outline"
  },
  growth: {
    key: "growth",
    bg: "#F5F3FF",
    border: "#C4B5FD",
    accent: "#7C3AED",
    iconBg: "#EDE9FE",
    icon: "trending-up-outline"
  },
  fattening: {
    key: "fattening",
    bg: "#F0FDF4",
    border: "#86EFAC",
    accent: "#16A34A",
    iconBg: "#DCFCE7",
    icon: "nutrition-outline"
  },
  boar: {
    key: "boar",
    bg: "#FFF7ED",
    border: "#FDBA74",
    accent: "#EA580C",
    iconBg: "#FFEDD5",
    icon: "male-outline"
  },
  quarantine: {
    key: "quarantine",
    bg: "#FEF2F2",
    border: "#FCA5A5",
    accent: "#DC2626",
    iconBg: "#FEE2E2",
    icon: "shield-outline"
  },
  mixed: {
    key: "mixed",
    bg: "#FFFBEB",
    border: "#FCD34D",
    accent: "#D97706",
    iconBg: "#FEF3C7",
    icon: "grid-outline"
  },
  empty: {
    key: "empty",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    accent: "#6B7280",
    iconBg: "#F3F4F6",
    icon: "cube-outline"
  }
};

export function resolvePenUsageTag(
  pen: Pick<CheptelPenRowDto, "usageTag" | "category" | "batchTypeTag">
): PenUsageTag {
  if (pen.usageTag && pen.usageTag !== "mixed") {
    return pen.usageTag;
  }
  if (pen.batchTypeTag === "fattening") {
    return "fattening";
  }
  if (pen.batchTypeTag === "starter") {
    return "starter";
  }
  return (
    pen.usageTag ??
    (pen.category === "maternity"
      ? "sows"
      : pen.category === "starter" ||
          pen.category === "fattening" ||
          pen.category === "empty"
        ? pen.category
        : "mixed")
  );
}

function isGrowthPhase(pen: Pick<CheptelPenRowDto, "averageWeightKg" | "ageData">): boolean {
  const kg = pen.averageWeightKg;
  if (kg != null && kg >= GROWTH_WEIGHT_KG) {
    return true;
  }
  const weeks = pen.ageData?.displayAgeWeeks;
  return weeks != null && weeks >= GROWTH_AGE_WEEKS;
}

export function resolvePenVisualKey(
  pen: Pick<
    CheptelPenRowDto,
    | "usageTag"
    | "category"
    | "occupancy"
    | "averageWeightKg"
    | "ageData"
    | "categoryForced"
    | "batchTypeTag"
  >
): PenVisualKey {
  if (pen.occupancy === 0 || pen.category === "empty") {
    if (pen.category && pen.category !== "empty") {
      return categoryToVisualKey(pen.category);
    }
    return "empty";
  }

  if (pen.category === "quarantine") {
    return "quarantine";
  }

  const usage = resolvePenUsageTag(pen);

  if (usage === "sows" || pen.category === "maternity") {
    return "maternity";
  }
  if (usage === "boar" || usage === "boars") {
    return "boar";
  }
  if (usage === "fattening" || pen.category === "fattening") {
    return "fattening";
  }
  if (usage === "starter" || pen.category === "starter") {
    return isGrowthPhase(pen) ? "growth" : "starter";
  }
  if (usage === "mixed" || pen.category === "mixed") {
    return "mixed";
  }
  return "mixed";
}

function categoryToVisualKey(category: PenCategoryKey): PenVisualKey {
  switch (category) {
    case "maternity":
      return "maternity";
    case "starter":
      return "starter";
    case "fattening":
      return "fattening";
    case "quarantine":
      return "quarantine";
    case "mixed":
      return "mixed";
    default:
      return "empty";
  }
}

export function getPenVisualForCategory(category: PenCategoryKey): PenVisual {
  return getPenVisual(categoryToVisualKey(category));
}

export function getPenVisual(key: PenVisualKey): PenVisual {
  return PEN_VISUALS[key];
}

export function getPenVisualForPen(
  pen: Pick<
    CheptelPenRowDto,
    | "usageTag"
    | "category"
    | "occupancy"
    | "averageWeightKg"
    | "ageData"
    | "categoryForced"
    | "batchTypeTag"
  >
): PenVisual {
  return getPenVisual(resolvePenVisualKey(pen));
}

/** Clé i18n `cheptel.pens.visual.*` */
export function penVisualI18nKey(key: PenVisualKey): string {
  return key === "boar" ? "boar" : key;
}
