/** Couleurs fixes pour le pie chart répartition cheptel (Build 7). */
export const CHEPTEL_CATEGORY_COLORS: Record<string, string> = {
  reproducteur_femelle: "#FF6B8A",
  reproducteur_male: "#4A90D9",
  sous_mere: "#F472B6",
  fattening: "#7C3AED",
  starter: "#FF8C00",
  growth: "#1D9E75",
  other: "#94A3B8",
  // Legacy keys (compatibilité)
  piglets: "#FF8C00",
  finishing: "#7C3AED",
  breeders: "#FF6B8A"
};

export function cheptelCategoryColor(key: string, fallbackIndex = 0): string {
  return (
    CHEPTEL_CATEGORY_COLORS[key] ??
    ["#FF8C00", "#1D9E75", "#7C3AED", "#4A90D9", "#FF6B8A"][fallbackIndex % 5]!
  );
}
