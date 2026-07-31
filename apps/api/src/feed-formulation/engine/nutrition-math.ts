import type {
  IngredientNutrition,
  NutritionResult,
  RequirementProfileSnapshot
} from "./feed-formulation.types";

const EPS = 1e-9;

/** Ratio g lysine / Mcal EM à partir des % / kcal du mélange. */
export function lysinePerMcal(
  lysinePct: number,
  metabolizableEnergyKcal: number
): number | null {
  if (metabolizableEnergyKcal <= EPS) return null;
  return (10_000 * lysinePct) / metabolizableEnergyKcal;
}

export function blendNutrition(
  proportions: Record<string, number>,
  nutritionById: Record<string, IngredientNutrition>
): NutritionResult {
  let crudeProteinPct = 0;
  let metabolizableEnergyKcal = 0;
  let lysinePct = 0;
  let methioninePct = 0;
  let calciumPct = 0;
  let phosphorusPct = 0;
  let crudeFiberPct = 0;

  for (const [id, p] of Object.entries(proportions)) {
    if (p <= 0) continue;
    const n = nutritionById[id];
    if (!n) continue;
    crudeProteinPct += p * n.crudeProteinPct;
    metabolizableEnergyKcal += p * n.metabolizableEnergyKcal;
    lysinePct += p * n.lysinePct;
    methioninePct += p * n.methioninePct;
    calciumPct += p * n.calciumPct;
    phosphorusPct += p * n.phosphorusPct;
    crudeFiberPct += p * n.crudeFiberPct;
  }

  return {
    crudeProteinPct,
    metabolizableEnergyKcal,
    lysinePct,
    methioninePct,
    calciumPct,
    phosphorusPct,
    crudeFiberPct,
    lysinePerMcal: lysinePerMcal(lysinePct, metabolizableEnergyKcal)
  };
}

export function roundNutrition(n: NutritionResult, digits = 4): NutritionResult {
  const r = (v: number) =>
    Math.round(v * 10 ** digits) / 10 ** digits;
  return {
    crudeProteinPct: r(n.crudeProteinPct),
    metabolizableEnergyKcal: r(n.metabolizableEnergyKcal),
    lysinePct: r(n.lysinePct),
    methioninePct: r(n.methioninePct),
    calciumPct: r(n.calciumPct),
    phosphorusPct: r(n.phosphorusPct),
    crudeFiberPct: r(n.crudeFiberPct),
    lysinePerMcal:
      n.lysinePerMcal == null ? null : r(n.lysinePerMcal)
  };
}

type BoundCheck = {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
};

export function evaluateDeviations(
  profile: RequirementProfileSnapshot,
  nutrition: NutritionResult,
  tol = 1e-6
): BoundCheck[] {
  const checks: BoundCheck[] = [];

  const pushMin = (
    nutrient: string,
    min: number,
    actual: number
  ) => {
    checks.push({
      nutrient,
      target: `≥ ${min}`,
      actual,
      withinBounds: actual + tol >= min
    });
  };
  const pushMax = (
    nutrient: string,
    max: number,
    actual: number
  ) => {
    checks.push({
      nutrient,
      target: `≤ ${max}`,
      actual,
      withinBounds: actual - tol <= max
    });
  };

  pushMin("crudeProteinPct", profile.minCrudeProteinPct, nutrition.crudeProteinPct);
  if (profile.maxCrudeProteinPct != null) {
    pushMax("crudeProteinPct", profile.maxCrudeProteinPct, nutrition.crudeProteinPct);
  }
  pushMin(
    "metabolizableEnergyKcal",
    profile.minMetabolizableEnergyKcal,
    nutrition.metabolizableEnergyKcal
  );
  if (profile.maxMetabolizableEnergyKcal != null) {
    pushMax(
      "metabolizableEnergyKcal",
      profile.maxMetabolizableEnergyKcal,
      nutrition.metabolizableEnergyKcal
    );
  }
  pushMin("lysinePct", profile.minLysinePct, nutrition.lysinePct);
  pushMin("methioninePct", profile.minMethioninePct, nutrition.methioninePct);
  pushMin("calciumPct", profile.minCalciumPct, nutrition.calciumPct);
  if (profile.maxCalciumPct != null) {
    pushMax("calciumPct", profile.maxCalciumPct, nutrition.calciumPct);
  }
  pushMin("phosphorusPct", profile.minPhosphorusPct, nutrition.phosphorusPct);
  if (profile.maxFiberPct != null) {
    pushMax("crudeFiberPct", profile.maxFiberPct, nutrition.crudeFiberPct);
  }
  if (profile.minLysinePerMcal != null) {
    const actual = nutrition.lysinePerMcal ?? 0;
    checks.push({
      nutrient: "lysinePerMcal",
      target: `≥ ${profile.minLysinePerMcal}`,
      actual,
      withinBounds: actual + tol >= profile.minLysinePerMcal
    });
  }

  return checks;
}

/**
 * Coefficient variable pour la contrainte lysine/énergie :
 * sum((10000×lys_i − R×me_i) × x_i) ≥ 0
 */
export function lysineEnergyCoeff(
  lysinePct: number,
  metabolizableEnergyKcal: number,
  minLysinePerMcal: number
): number {
  return 10_000 * lysinePct - minLysinePerMcal * metabolizableEnergyKcal;
}
