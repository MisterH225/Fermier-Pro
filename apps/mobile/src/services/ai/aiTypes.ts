export const AI_MODULE_KEYS = [
  "finance",
  "cheptel",
  "sante",
  "sante_diseases",
  "stock",
  "gestation",
  "global_dashboard"
] as const;

export type AIModuleKey = (typeof AI_MODULE_KEYS)[number];

export type AIInsightPriority = "critical" | "warning" | "info";

export type AIInsight = {
  type: AIModuleKey;
  priority: AIInsightPriority;
  title: string;
  message: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type AIRecommendationsResponse = {
  items: AIInsight[];
  generatedAt: string;
  insufficient?: boolean;
  unavailable?: boolean;
};

/** TTL cache par module (millisecondes). */
export const AI_CACHE_TTL_MS: Record<AIModuleKey, number> = {
  finance: 24 * 60 * 60 * 1000,
  cheptel: 12 * 60 * 60 * 1000,
  sante: 6 * 60 * 60 * 1000,
  sante_diseases: 6 * 60 * 60 * 1000,
  stock: 12 * 60 * 60 * 1000,
  gestation: 6 * 60 * 60 * 1000,
  global_dashboard: 24 * 60 * 60 * 1000
};
