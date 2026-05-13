import type { PrismaClient } from "@prisma/client";
import { FinanceCategoryType } from "@prisma/client";

type CatSeed = {
  type: FinanceCategoryType;
  key: string;
  name: string;
  icon: string;
};

/** Catégories par défaut (une seule fois par ferme, si aucune catégorie). */
export const DEFAULT_FINANCE_CATEGORY_SEEDS: CatSeed[] = [
  { type: "expense", key: "feed", name: "Alimentation", icon: "🌾" },
  { type: "expense", key: "health", name: "Santé", icon: "💊" },
  { type: "expense", key: "equipment", name: "Équipements", icon: "🔧" },
  { type: "expense", key: "labor", name: "Main d'œuvre", icon: "👷" },
  { type: "expense", key: "infrastructure", name: "Infrastructure", icon: "🏗️" },
  { type: "expense", key: "transport", name: "Transport / logistique", icon: "🚚" },
  { type: "expense", key: "other_purchases", name: "Autres achats", icon: "📦" },
  { type: "income", key: "animal_sales", name: "Ventes animaux", icon: "🐷" },
  { type: "income", key: "product_sales", name: "Ventes produits", icon: "🥩" },
  { type: "income", key: "subsidies", name: "Subventions / aides", icon: "🤝" },
  { type: "income", key: "other_income", name: "Autres revenus", icon: "💼" }
];

export async function ensureFarmFinanceBootstrap(
  prisma: PrismaClient,
  farmId: string
): Promise<void> {
  await prisma.farmFinanceSettings.upsert({
    where: { farmId },
    create: {
      farmId,
      currencyCode: "XOF",
      currencySymbol: "FCFA"
    },
    update: {}
  });

  const count = await prisma.financeCategory.count({ where: { farmId } });
  if (count > 0) {
    return;
  }

  await prisma.financeCategory.createMany({
    data: DEFAULT_FINANCE_CATEGORY_SEEDS.map((c) => ({
      farmId,
      type: c.type,
      key: c.key,
      name: c.name,
      icon: c.icon,
      isDefault: true
    }))
  });
}
