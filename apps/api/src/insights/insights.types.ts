export type InsightI18nRef = {
  key: string;
  params?: Record<string, string | number>;
};

export type InsightResponse = {
  kind: "first" | "delta" | "compare" | "info";
  headline: InsightI18nRef;
  detail?: InsightI18nRef;
};
