import { Ionicons } from "@expo/vector-icons";

type IonIcon = keyof typeof Ionicons.glyphMap;

export type CategoryVisual = {
  bg: string;
  accent: string;
  icon: IonIcon;
  useEmoji?: boolean;
};

const PASTEL_CYCLE: Omit<CategoryVisual, "icon">[] = [
  { bg: "#FEE2E2", accent: "#EF4444" },
  { bg: "#DBEAFE", accent: "#3B82F6" },
  { bg: "#D1FAE5", accent: "#10B981" },
  { bg: "#EDE9FE", accent: "#8B5CF6" },
  { bg: "#FEF3C7", accent: "#EAB308" },
  { bg: "#FFEDD5", accent: "#F97316" },
  { bg: "#E0F2FE", accent: "#0EA5E9" },
  { bg: "#FCE7F3", accent: "#EC4899" }
];

const KEY_VISUALS: Record<string, CategoryVisual> = {
  feed: { bg: "#D1FAE5", accent: "#059669", icon: "leaf-outline" },
  health: { bg: "#FEE2E2", accent: "#DC2626", icon: "medical-outline" },
  equipment: { bg: "#DBEAFE", accent: "#2563EB", icon: "construct-outline" },
  labor: { bg: "#EDE9FE", accent: "#7C3AED", icon: "people-outline" },
  infrastructure: { bg: "#E0E7FF", accent: "#4F46E5", icon: "business-outline" },
  transport: { bg: "#FEF3C7", accent: "#CA8A04", icon: "car-outline" },
  other_purchases: { bg: "#FFEDD5", accent: "#EA580C", icon: "cube-outline" },
  animal_sales: { bg: "#FCE7F3", accent: "#DB2777", icon: "paw-outline" },
  product_sales: { bg: "#FEE2E2", accent: "#B91C1C", icon: "restaurant-outline" },
  subsidies: { bg: "#DBEAFE", accent: "#1D4ED8", icon: "hand-left-outline" },
  other_income: { bg: "#D1FAE5", accent: "#047857", icon: "wallet-outline" },
  uncategorized: { bg: "#F3F4F6", accent: "#6B7280", icon: "document-text-outline" }
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
