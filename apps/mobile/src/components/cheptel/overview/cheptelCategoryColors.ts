import { uiNamedColors } from "../../../theme/uiNamedColors";
/** Couleurs fixes pour le pie chart répartition cheptel (Build 7). */
export const CHEPTEL_CATEGORY_COLORS: Record<string, string> = {
  reproducteur_femelle: uiNamedColors.cFF6B8A,
  reproducteur_male: uiNamedColors.c4A90D9,
  sous_mere: uiNamedColors.cF472B6,
  fattening: uiNamedColors.c7C3AED,
  starter: uiNamedColors.cFF8C00,
  growth: uiNamedColors.c1D9E75,
  other: uiNamedColors.c94A3B8,
  // Legacy keys (compatibilité)
  piglets: uiNamedColors.cFF8C00,
  finishing: uiNamedColors.c7C3AED,
  breeders: uiNamedColors.cFF6B8A
};

export function cheptelCategoryColor(key: string, fallbackIndex = 0): string {
  return (
    CHEPTEL_CATEGORY_COLORS[key] ??
    [uiNamedColors.cFF8C00, uiNamedColors.c1D9E75, uiNamedColors.c7C3AED, uiNamedColors.c4A90D9, uiNamedColors.cFF6B8A][fallbackIndex % 5]!
  );
}
