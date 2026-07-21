import { Ionicons } from "@expo/vector-icons";
import type { CheptelPenRowDto, PenCategoryKey, PenUsageTag } from "../../../lib/api";
import { uiNamedColors } from "../../../theme/uiNamedColors";

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
    bg: uiNamedColors.cFDF2F8,
    border: uiNamedColors.cF9A8D4,
    accent: uiNamedColors.cDB2777,
    iconBg: uiNamedColors.cFCE7F3,
    icon: "heart-outline"
  },
  starter: {
    key: "starter",
    bg: uiNamedColors.cEFF6FF,
    border: uiNamedColors.c93C5FD,
    accent: uiNamedColors.c2563EB,
    iconBg: uiNamedColors.cDBEAFE,
    icon: "egg-outline"
  },
  growth: {
    key: "growth",
    bg: uiNamedColors.cF5F3FF,
    border: uiNamedColors.cC4B5FD,
    accent: uiNamedColors.c7C3AED,
    iconBg: uiNamedColors.cEDE9FE,
    icon: "trending-up-outline"
  },
  fattening: {
    key: "fattening",
    bg: uiNamedColors.cF0FDF4,
    border: uiNamedColors.c86EFAC,
    accent: uiNamedColors.c16A34A,
    iconBg: uiNamedColors.cDCFCE7,
    icon: "nutrition-outline"
  },
  boar: {
    key: "boar",
    bg: uiNamedColors.cFFF7ED,
    border: uiNamedColors.cFDBA74,
    accent: uiNamedColors.cEA580C,
    iconBg: uiNamedColors.cFFEDD5,
    icon: "male-outline"
  },
  quarantine: {
    key: "quarantine",
    bg: uiNamedColors.cFEF2F2,
    border: uiNamedColors.cFCA5A5,
    accent: uiNamedColors.cDC2626,
    iconBg: uiNamedColors.cFEE2E2,
    icon: "shield-outline"
  },
  mixed: {
    key: "mixed",
    bg: uiNamedColors.cFFFBEB,
    border: uiNamedColors.cFCD34D,
    accent: uiNamedColors.cD97706,
    iconBg: uiNamedColors.cFEF3C7,
    icon: "grid-outline"
  },
  empty: {
    key: "empty",
    bg: uiNamedColors.cF9FAFB,
    border: uiNamedColors.cE5E7EB,
    accent: uiNamedColors.c6B7280,
    iconBg: uiNamedColors.cF3F4F6,
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
  if (pen.batchTypeTag === "sous_mere") {
    return "nursing";
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

  if (usage === "sows" || usage === "nursing" || pen.category === "maternity") {
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
