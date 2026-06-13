/** Catégories finance considérées comme coûts directs (marge brute). */
export const DIRECT_EXPENSE_CATEGORY_KEYS = new Set([
  "feed",
  "health",
  "other_purchases"
]);

/** Catégories finance considérées comme coûts indirects (marge nette). */
export const INDIRECT_EXPENSE_CATEGORY_KEYS = new Set([
  "labor",
  "equipment",
  "infrastructure",
  "transport",
  "other"
]);

export const INCOME_CATEGORY_KEYS = new Set([
  "animal_sales",
  "product_sales",
  "subsidies",
  "other_income"
]);

export const COST_BREAKDOWN_LABELS: Record<string, string> = {
  feed: "Alimentation",
  health: "Santé et vétérinaire",
  other_purchases: "Achats animaux",
  labor: "Main d'œuvre",
  equipment: "Équipement",
  infrastructure: "Infrastructure",
  transport: "Transport",
  other: "Divers"
};
