import type { FeedIngredientCategory } from "@prisma/client";
import type {
  IngredientRoleContext,
  NutritionForExplain,
  RationLineForExplain
} from "./composition-explanation.types";

const CATEGORY_LABEL_FR: Record<string, string> = {
  cereal: "céréale (énergie)",
  plant_protein: "protéine végétale",
  animal_protein: "protéine animale",
  byproduct: "sous-produit",
  mineral: "minéral",
  additive: "additif / prémélange"
};

export function categoryLabelFr(category: string): string {
  return CATEGORY_LABEL_FR[category] ?? category;
}

/** Nutriments dominants d'un intrant (seuils relatifs simples). */
export function dominantNutrientsOf(n: {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  calciumPct: number;
  phosphorusPct: number;
}): string[] {
  const out: string[] = [];
  if (n.metabolizableEnergyKcal >= 2800) out.push("énergie");
  if (n.crudeProteinPct >= 20) out.push("protéines");
  if (n.lysinePct >= 1.5) out.push("lysine");
  if (n.calciumPct >= 5) out.push("calcium");
  if (n.phosphorusPct >= 5) out.push("phosphore");
  if (out.length === 0) {
    // Fallback : le plus fort relatif
    if (n.metabolizableEnergyKcal >= 1500) out.push("énergie");
    else if (n.crudeProteinPct >= 8) out.push("protéines");
    else if (n.calciumPct >= 1 || n.phosphorusPct >= 1) out.push("minéraux");
    else out.push("complément");
  }
  return out;
}

export function buildIngredientRoles(
  ration: RationLineForExplain[],
  byId: Map<
    string,
    {
      canonicalName: string;
      category: FeedIngredientCategory | string;
      crudeProteinPct: number;
      metabolizableEnergyKcal: number;
      lysinePct: number;
      calciumPct: number;
      phosphorusPct: number;
    }
  >
): IngredientRoleContext[] {
  return ration
    .filter((l) => (Number(l.proportionPct) || 0) > 0)
    .sort((a, b) => (b.proportionPct || 0) - (a.proportionPct || 0))
    .map((l) => {
      const row = byId.get(l.feedIngredientId);
      const name =
        l.canonicalName?.trim() ||
        row?.canonicalName ||
        l.feedIngredientId;
      const category = row?.category ?? "additive";
      return {
        feedIngredientId: l.feedIngredientId,
        name,
        category: String(category),
        categoryLabelFr: categoryLabelFr(String(category)),
        dominantNutrients: row
          ? dominantNutrientsOf(row)
          : ["complément"],
        proportionPct: Number(l.proportionPct) || 0
      };
    });
}

export function formatNutritionLine(n: NutritionForExplain): string {
  return [
    `protéines ${n.crudeProteinPct} %`,
    `énergie ${n.metabolizableEnergyKcal} kcal/kg`,
    `lysine ${n.lysinePct} %`,
    `méthionine ${n.methioninePct} %`,
    `calcium ${n.calciumPct} %`,
    `phosphore ${n.phosphorusPct} %`,
    `fibres ${n.crudeFiberPct} %`,
    n.lysinePerMcal != null
      ? `lysine/énergie ${n.lysinePerMcal} g/Mcal`
      : null
  ]
    .filter(Boolean)
    .join(" ; ");
}
