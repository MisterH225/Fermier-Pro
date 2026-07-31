/**
 * Seed du référentiel FeedIngredient (point de départ CI / tropiques).
 *
 * IMPORTANT — valeurs nutritionnelles INDICATIVES (matière brute, porc) :
 * à valider par un nutritionniste / vétérinaire avant mise en service
 * du moteur de formulation. Sources publiques de référence : Feedipedia,
 * tables INRAE (porcs) — ordres de grandeur adaptés au contexte ivoirien.
 *
 * Le superadmin peut corriger toutes ces valeurs via la console admin.
 */
export type FeedIngredientCategorySeed =
  | "cereal"
  | "plant_protein"
  | "animal_protein"
  | "byproduct"
  | "mineral"
  | "additive";

export type FeedIngredientSeed = {
  canonicalName: string;
  aliases: string[];
  category: FeedIngredientCategorySeed;
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  fatPct: number;
  dryMatterPct: number;
  /** Additif à taux fixe (CMV, sel…) — hors optimisation LP. */
  isPremix?: boolean;
  notes?: string;
};

export const FEED_INGREDIENTS_SEED: FeedIngredientSeed[] = [
  // —— Céréales / énergie ——
  {
    canonicalName: "Maïs jaune",
    aliases: ["mais jaune", "maïs", "mais", "corn", "maize"],
    category: "cereal",
    crudeProteinPct: 8.5,
    metabolizableEnergyKcal: 3300,
    lysinePct: 0.25,
    methioninePct: 0.18,
    calciumPct: 0.02,
    phosphorusPct: 0.27,
    crudeFiberPct: 2.2,
    fatPct: 3.8,
    dryMatterPct: 86,
    notes: "Feedipedia / INRAE — grain maïs jaune (indicatif)"
  },
  {
    canonicalName: "Son de riz",
    aliases: ["rice bran", "son riz"],
    category: "byproduct",
    crudeProteinPct: 13,
    metabolizableEnergyKcal: 2400,
    lysinePct: 0.55,
    methioninePct: 0.25,
    calciumPct: 0.1,
    phosphorusPct: 1.5,
    crudeFiberPct: 12,
    fatPct: 14,
    dryMatterPct: 90,
    notes: "Feedipedia — son de riz complet (indicatif)"
  },
  {
    canonicalName: "Son de blé",
    aliases: ["wheat bran", "son ble", "son blé"],
    category: "byproduct",
    crudeProteinPct: 15.5,
    metabolizableEnergyKcal: 2300,
    lysinePct: 0.6,
    methioninePct: 0.23,
    calciumPct: 0.13,
    phosphorusPct: 1.15,
    crudeFiberPct: 10,
    fatPct: 4,
    dryMatterPct: 87,
    notes: "Feedipedia / INRAE — son de blé (indicatif)"
  },
  {
    canonicalName: "Cossettes de manioc",
    aliases: ["manioc séché", "cassava chips", "cossette manioc", "manioc"],
    category: "byproduct",
    crudeProteinPct: 2.5,
    metabolizableEnergyKcal: 3000,
    lysinePct: 0.07,
    methioninePct: 0.03,
    calciumPct: 0.2,
    phosphorusPct: 0.1,
    crudeFiberPct: 4.5,
    fatPct: 0.8,
    dryMatterPct: 88,
    notes: "Feedipedia — cossettes / chips manioc séché (indicatif)"
  },
  {
    canonicalName: "Mélasse",
    aliases: ["melasse", "molasses", "mélasse de canne"],
    category: "byproduct",
    crudeProteinPct: 4,
    metabolizableEnergyKcal: 2400,
    lysinePct: 0.01,
    methioninePct: 0.01,
    calciumPct: 0.8,
    phosphorusPct: 0.1,
    crudeFiberPct: 0,
    fatPct: 0.1,
    dryMatterPct: 75,
    notes: "Feedipedia — mélasse de canne (indicatif)"
  },

  // —— Protéines végétales ——
  {
    canonicalName: "Tourteau de soja",
    aliases: ["soja", "soybean meal", "tourteau soja"],
    category: "plant_protein",
    crudeProteinPct: 44,
    metabolizableEnergyKcal: 3200,
    lysinePct: 2.7,
    methioninePct: 0.6,
    calciumPct: 0.3,
    phosphorusPct: 0.65,
    crudeFiberPct: 6,
    fatPct: 1.5,
    dryMatterPct: 88,
    notes: "Feedipedia / INRAE — tourteau soja 44 % (indicatif)"
  },
  {
    canonicalName: "Tourteau de coton",
    aliases: ["cottonseed meal", "tourteau coton"],
    category: "plant_protein",
    crudeProteinPct: 38,
    metabolizableEnergyKcal: 2500,
    lysinePct: 1.5,
    methioninePct: 0.55,
    calciumPct: 0.2,
    phosphorusPct: 1.0,
    crudeFiberPct: 12,
    fatPct: 1.5,
    dryMatterPct: 90,
    notes: "Feedipedia — tourteau coton décortiqué (indicatif)"
  },
  {
    canonicalName: "Tourteau de palmiste",
    aliases: ["palm kernel meal", "tourteau palmiste", "palmiste"],
    category: "plant_protein",
    crudeProteinPct: 18,
    metabolizableEnergyKcal: 2200,
    lysinePct: 0.55,
    methioninePct: 0.35,
    calciumPct: 0.3,
    phosphorusPct: 0.6,
    crudeFiberPct: 15,
    fatPct: 8,
    dryMatterPct: 90,
    notes: "Feedipedia — tourteau palmiste (indicatif)"
  },
  {
    canonicalName: "Tourteau d'arachide",
    aliases: ["groundnut meal", "tourteau arachide", "arachide"],
    category: "plant_protein",
    crudeProteinPct: 45,
    metabolizableEnergyKcal: 2800,
    lysinePct: 1.5,
    methioninePct: 0.5,
    calciumPct: 0.2,
    phosphorusPct: 0.6,
    crudeFiberPct: 8,
    fatPct: 6,
    dryMatterPct: 90,
    notes: "Feedipedia — tourteau arachide (indicatif)"
  },
  {
    canonicalName: "Drèche de brasserie séchée",
    aliases: ["drêche", "dreche", "brewers grains", "drèche de brasserie"],
    category: "plant_protein",
    crudeProteinPct: 25,
    metabolizableEnergyKcal: 2200,
    lysinePct: 0.9,
    methioninePct: 0.4,
    calciumPct: 0.3,
    phosphorusPct: 0.6,
    crudeFiberPct: 15,
    fatPct: 7,
    dryMatterPct: 92,
    notes: "Feedipedia — drêches de brasserie séchées (indicatif)"
  },
  {
    canonicalName: "Feuilles de manioc séchées",
    aliases: ["cassava leaves", "feuilles manioc", "feuille de manioc"],
    category: "plant_protein",
    crudeProteinPct: 20,
    metabolizableEnergyKcal: 1800,
    lysinePct: 0.9,
    methioninePct: 0.3,
    calciumPct: 1.2,
    phosphorusPct: 0.3,
    crudeFiberPct: 18,
    fatPct: 5,
    dryMatterPct: 90,
    notes: "Feedipedia — feuilles de manioc séchées (indicatif)"
  },

  // —— Protéines animales ——
  {
    canonicalName: "Farine de poisson",
    aliases: ["fish meal", "farine poisson"],
    category: "animal_protein",
    crudeProteinPct: 60,
    metabolizableEnergyKcal: 3000,
    lysinePct: 4.5,
    methioninePct: 1.7,
    calciumPct: 5,
    phosphorusPct: 3,
    crudeFiberPct: 1,
    fatPct: 8,
    dryMatterPct: 92,
    notes: "Feedipedia / INRAE — farine de poisson 60 % (indicatif)"
  },
  {
    canonicalName: "Farine de sang",
    aliases: ["blood meal", "farine sang"],
    category: "animal_protein",
    crudeProteinPct: 80,
    metabolizableEnergyKcal: 2800,
    lysinePct: 7,
    methioninePct: 1.2,
    calciumPct: 0.3,
    phosphorusPct: 0.3,
    crudeFiberPct: 1,
    fatPct: 1.5,
    dryMatterPct: 92,
    notes: "Feedipedia — farine de sang (indicatif)"
  },
  {
    canonicalName: "Farine de viande et d'os",
    aliases: ["meat and bone meal", "farine viande os", "farine de viande"],
    category: "animal_protein",
    crudeProteinPct: 50,
    metabolizableEnergyKcal: 2500,
    lysinePct: 2.5,
    methioninePct: 0.7,
    calciumPct: 10,
    phosphorusPct: 5,
    crudeFiberPct: 2,
    fatPct: 10,
    dryMatterPct: 93,
    notes: "Feedipedia — farine de viande et d'os (indicatif)"
  },

  // —— Minéraux / additifs ——
  {
    canonicalName: "Coquilles d'huître",
    aliases: ["calcaire", "oyster shell", "coquille huitre", "carbonate de calcium"],
    category: "mineral",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 38,
    phosphorusPct: 0.1,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 99,
    notes: "Feedipedia — coquilles d'huître / calcaire (indicatif)"
  },
  {
    canonicalName: "Phosphate bicalcique",
    aliases: ["dicalcium phosphate", "DCP", "phosphate bicalcique"],
    category: "mineral",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 23,
    phosphorusPct: 18,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 99,
    notes: "Tables minéraux — phosphate bicalcique (indicatif)"
  },
  {
    canonicalName: "Sel",
    aliases: ["sel gemme", "NaCl", "salt"],
    category: "mineral",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 99,
    isPremix: true,
    notes: "Chlorure de sodium alimentaire (indicatif) — taux fixe par stade"
  },
  {
    canonicalName: "Complément minéral vitaminé (CMV)",
    aliases: ["CMV", "premix", "prémix", "complement mineral vitamine"],
    category: "additive",
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 15,
    phosphorusPct: 5,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 95,
    isPremix: true,
    notes:
      "Prémix CMV — composition variable selon fabricant (indicatif). Taux fixe par stade ; apports Ca/P comptent dans le bilan."
  },
  {
    canonicalName: "Lysine",
    aliases: ["L-lysine", "lysine HCl", "l lysine"],
    category: "additive",
    crudeProteinPct: 78,
    metabolizableEnergyKcal: 0,
    lysinePct: 78,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 99,
    notes: "L-lysine HCl synthétique — teneur en lysine ~78 % (indicatif)"
  },
  {
    canonicalName: "Méthionine",
    aliases: ["DL-méthionine", "methionine", "dl methionine", "méthionine"],
    category: "additive",
    crudeProteinPct: 99,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 99,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0,
    fatPct: 0,
    dryMatterPct: 99,
    notes: "DL-méthionine synthétique (indicatif)"
  }
];
