export const AI_MODULE_KEYS = [
  "finance",
  "cheptel",
  "sante",
  "sante_diseases",
  "stock",
  "gestation",
  "global_dashboard"
] as const;

export type AiModuleKey = (typeof AI_MODULE_KEYS)[number];

export type AiInsightPriority = "critical" | "warning" | "info";

export type AiInsightDto = {
  type: AiModuleKey;
  priority: AiInsightPriority;
  title: string;
  message: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type AiRecommendationsResponse = {
  items: AiInsightDto[];
  generatedAt: string;
  insufficient?: boolean;
  unavailable?: boolean;
};
