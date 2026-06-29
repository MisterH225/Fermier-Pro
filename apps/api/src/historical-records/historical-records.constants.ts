import type { HistoricalCategory } from "@prisma/client";

/** Catégories historiques de dépenses. */
export const HISTORICAL_EXPENSE_CATEGORIES: HistoricalCategory[] = [
  "achat_animaux",
  "aliments",
  "infrastructure",
  "sante_veterinaire",
  "main_oeuvre",
  "transport",
  "equipement",
  "autres_depenses"
];

/** Catégories historiques de revenus. */
export const HISTORICAL_INCOME_CATEGORIES: HistoricalCategory[] = [
  "vente_animaux",
  "vente_produits_derives",
  "subventions",
  "autres_revenus"
];

export const HISTORICAL_CATEGORY_LABELS: Record<HistoricalCategory, string> = {
  achat_animaux: "Achat d'animaux",
  aliments: "Aliments",
  infrastructure: "Infrastructure",
  sante_veterinaire: "Santé / vétérinaire",
  main_oeuvre: "Main d'œuvre",
  transport: "Transport",
  equipement: "Équipement",
  autres_depenses: "Autres dépenses",
  vente_animaux: "Vente d'animaux",
  vente_produits_derives: "Vente produits dérivés",
  subventions: "Subventions",
  autres_revenus: "Autres revenus"
};

/**
 * Mappe une catégorie historique vers la clé finance utilisée
 * pour le calcul direct/indirect de la rentabilité.
 */
export const HISTORICAL_TO_FINANCE_CATEGORY_KEY: Record<
  HistoricalCategory,
  string
> = {
  achat_animaux: "other_purchases",
  aliments: "feed",
  infrastructure: "infrastructure",
  sante_veterinaire: "health",
  main_oeuvre: "labor",
  transport: "transport",
  equipement: "equipment",
  autres_depenses: "other",
  vente_animaux: "animal_sales",
  vente_produits_derives: "product_sales",
  subventions: "subsidies",
  autres_revenus: "other_income"
};
