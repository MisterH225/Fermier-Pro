/** Clés des segments Cheptel (TabSelector de FarmLivestockScreen). */
export const FARM_LIVESTOCK_TAB_KEYS = [
  "overview",
  "batches",
  "cheptel",
  "weight",
  "gestation",
  "history"
] as const;

export type FarmLivestockTabKey = (typeof FARM_LIVESTOCK_TAB_KEYS)[number];

export function isFarmLivestockTabKey(value: string): value is FarmLivestockTabKey {
  return (FARM_LIVESTOCK_TAB_KEYS as readonly string[]).includes(value);
}
