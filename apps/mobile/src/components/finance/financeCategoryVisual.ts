import { Ionicons } from "@expo/vector-icons";
import { uiNamedColors } from "../../theme/uiNamedColors";

type IonIcon = keyof typeof Ionicons.glyphMap;

export type CategoryVisual = {
  bg: string;
  accent: string;
  icon: IonIcon;
  useEmoji?: boolean;
};

const PASTEL_CYCLE: Omit<CategoryVisual, "icon">[] = [
  { bg: uiNamedColors.cFEE2E2, accent: uiNamedColors.cEF4444 },
  { bg: uiNamedColors.cDBEAFE, accent: uiNamedColors.c3B82F6 },
  { bg: uiNamedColors.cD1FAE5, accent: uiNamedColors.c10B981 },
  { bg: uiNamedColors.cEDE9FE, accent: uiNamedColors.c8B5CF6 },
  { bg: uiNamedColors.cFEF3C7, accent: uiNamedColors.cEAB308 },
  { bg: uiNamedColors.cFFEDD5, accent: uiNamedColors.cF97316 },
  { bg: uiNamedColors.cE0F2FE, accent: uiNamedColors.c0EA5E9 },
  { bg: uiNamedColors.cFCE7F3, accent: uiNamedColors.cEC4899 }
];

const KEY_VISUALS: Record<string, CategoryVisual> = {
  feed: { bg: uiNamedColors.cD1FAE5, accent: uiNamedColors.c059669, icon: "leaf-outline" },
  health: { bg: uiNamedColors.cFEE2E2, accent: uiNamedColors.cDC2626, icon: "medical-outline" },
  equipment: { bg: uiNamedColors.cDBEAFE, accent: uiNamedColors.c2563EB, icon: "construct-outline" },
  labor: { bg: uiNamedColors.cEDE9FE, accent: uiNamedColors.c7C3AED, icon: "people-outline" },
  infrastructure: { bg: uiNamedColors.cE0E7FF, accent: uiNamedColors.c4F46E5, icon: "business-outline" },
  transport: { bg: uiNamedColors.cFEF3C7, accent: uiNamedColors.cCA8A04, icon: "car-outline" },
  other_purchases: { bg: uiNamedColors.cFFEDD5, accent: uiNamedColors.cEA580C, icon: "cube-outline" },
  animal_sales: { bg: uiNamedColors.cFCE7F3, accent: uiNamedColors.cDB2777, icon: "paw-outline" },
  product_sales: { bg: uiNamedColors.cFEE2E2, accent: uiNamedColors.cB91C1C, icon: "restaurant-outline" },
  subsidies: { bg: uiNamedColors.cDBEAFE, accent: uiNamedColors.c1D4ED8, icon: "hand-left-outline" },
  other_income: { bg: uiNamedColors.cD1FAE5, accent: uiNamedColors.c047857, icon: "wallet-outline" },
  uncategorized: { bg: uiNamedColors.cF3F4F6, accent: uiNamedColors.c6B7280, icon: "document-text-outline" }
};

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function isEmojiIcon(icon: string | null | undefined): boolean {
  if (!icon?.trim()) {
    return false;
  }
  return EMOJI_RE.test(icon.trim());
}

export function getFinanceCategoryVisual(
  key: string,
  index: number,
  iconField?: string | null
): CategoryVisual {
  const mapped = KEY_VISUALS[key];
  if (mapped) {
    if (iconField && isEmojiIcon(iconField)) {
      return { ...mapped, useEmoji: true };
    }
    return mapped;
  }
  const cycle = PASTEL_CYCLE[index % PASTEL_CYCLE.length];
  if (iconField && isEmojiIcon(iconField)) {
    return {
      ...cycle,
      icon: "ellipse-outline",
      useEmoji: true
    };
  }
  return {
    ...cycle,
    icon: "pricetag-outline"
  };
}
