import type { AIModuleKey } from "./aiTypes";

/** Libellés module — prompts construits côté API Nest. */
export const AI_MODULE_LABELS: Record<AIModuleKey, string> = {
  finance: "Finance",
  cheptel: "Cheptel",
  sante: "Santé",
  stock: "Stock aliment",
  gestation: "Gestation",
  global_dashboard: "Tableau de bord"
};
