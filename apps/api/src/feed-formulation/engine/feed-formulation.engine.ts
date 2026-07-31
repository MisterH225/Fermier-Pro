import type { SolverPort } from "../solver/solver.port";
import { resolveDailyIntakeKg } from "./daily-intake";
import {
  blendNutrition,
  evaluateDeviations,
  lysineEnergyCoeff,
  roundNutrition
} from "./nutrition-math";
import type {
  AvailableIngredientInput,
  FormulateInput,
  FormulateResult,
  IngredientNutrition,
  RequirementProfileSnapshot,
  SubstitutionResult
} from "./feed-formulation.types";

const QTY_DIGITS = 4;
const COST_DIGITS = 2;

/**
 * Moteur pur de formulation au moindre coût.
 * Aucun I/O — reçoit profil + nutrition + disponibilités déjà résolus.
 */
export class FeedFormulationEngine {
  constructor(private readonly solver: SolverPort) {}

  formulate(input: FormulateInput): FormulateResult {
    const warnings: string[] = [];
    const validation = validateInput(input);
    if (validation) {
      return emptyInfeasible([validation], warnings);
    }

    const dailyIntakeKg = resolveDailyIntakeKg(
      input.profile.targetDailyIntakeKg,
      input.stage,
      input.avgWeightKg
    );
    const totalFeedKg =
      dailyIntakeKg * input.animalCount * input.durationDays;

    if (totalFeedKg <= 0) {
      return emptyInfeasible(
        ["Quantité totale d'aliment nulle ou négative."],
        warnings
      );
    }

    const candidates = prepareCandidates(
      input.availableIngredients,
      input.nutritionById,
      totalFeedKg,
      warnings
    );
    if (candidates.length === 0) {
      return emptyInfeasible(
        [
          "Aucun intrant disponible avec stock et prix valides pour formuler la ration."
        ],
        warnings
      );
    }

    const model = buildLpModel(candidates, input.profile, totalFeedKg);
    const solution = this.solver.solve(model);

    if (!solution.feasible) {
      const reasons = diagnoseInfeasibility(
        this.solver,
        candidates,
        input.profile,
        totalFeedKg
      );
      return {
        feasible: false,
        ration: [],
        totalFeedKg: round(totalFeedKg, QTY_DIGITS),
        dailyIntakeKg: round(dailyIntakeKg, QTY_DIGITS),
        totalCostXof: 0,
        costPerKg: 0,
        nutritionResult: null,
        deviations: [],
        warnings,
        infeasibilityReasons: reasons
      };
    }

    const proportions: Record<string, number> = {};
    let sumP = 0;
    for (const c of candidates) {
      const p = solution.values[c.varId] ?? 0;
      if (p > 1e-12) {
        proportions[c.feedIngredientId] = p;
        sumP += p;
      }
    }
    // Renormalisation numérique légère (erreurs flottantes du simplex).
    if (sumP > 0 && Math.abs(sumP - 1) > 1e-6) {
      for (const id of Object.keys(proportions)) {
        proportions[id] /= sumP;
      }
      warnings.push(
        "Proportions renormalisées après résolution (écart numérique mineur)."
      );
    }

    const nutrition = roundNutrition(
      blendNutrition(proportions, input.nutritionById)
    );
    const deviations = evaluateDeviations(input.profile, nutrition);

    // Sécurité : ne jamais renvoyer une ration hors bornes comme valide.
    const outOfBounds = deviations.filter((d) => !d.withinBounds);
    if (outOfBounds.length > 0) {
      return {
        feasible: false,
        ration: [],
        totalFeedKg: round(totalFeedKg, QTY_DIGITS),
        dailyIntakeKg: round(dailyIntakeKg, QTY_DIGITS),
        totalCostXof: 0,
        costPerKg: 0,
        nutritionResult: nutrition,
        deviations,
        warnings,
        infeasibilityReasons: [
          "La solution du solveur ne respecte pas les bornes nutritionnelles après contrôle (sécurité).",
          ...outOfBounds.map(
            (d) =>
              `${d.nutrient} = ${d.actual.toFixed(4)} (cible ${d.target})`
          )
        ]
      };
    }

    const ration = Object.entries(proportions)
      .map(([feedIngredientId, p]) => {
        const quantityKg = p * totalFeedKg;
        const price =
          candidates.find((c) => c.feedIngredientId === feedIngredientId)
            ?.pricePerKg ?? 0;
        return {
          feedIngredientId,
          quantityKg: round(quantityKg, QTY_DIGITS),
          proportionPct: round(p * 100, 4),
          costContribution: round(quantityKg * price, COST_DIGITS)
        };
      })
      .sort((a, b) => b.proportionPct - a.proportionPct);

    const totalCostXof = round(
      ration.reduce((s, l) => s + l.costContribution, 0),
      COST_DIGITS
    );
    const costPerKg = round(totalCostXof / totalFeedKg, COST_DIGITS);

    return {
      feasible: true,
      ration,
      totalFeedKg: round(totalFeedKg, QTY_DIGITS),
      dailyIntakeKg: round(dailyIntakeKg, QTY_DIGITS),
      totalCostXof,
      costPerKg,
      nutritionResult: nutrition,
      deviations,
      warnings,
      infeasibilityReasons: []
    };
  }

  /**
   * Relance la formulation en retirant un intrant et en autorisant un substitut.
   * Pure / déterministe — aucun effet de bord.
   */
  recomputeWithSubstitution(
    baseInput: FormulateInput,
    removeIngredientId: string,
    addIngredient: AvailableIngredientInput & { nutrition: IngredientNutrition }
  ): SubstitutionResult {
    const base = this.formulate(baseInput);

    const filtered = baseInput.availableIngredients.filter(
      (a) => a.feedIngredientId !== removeIngredientId
    );
    const withoutDup = filtered.filter(
      (a) => a.feedIngredientId !== addIngredient.feedIngredientId
    );
    const nextAvailable = [
      ...withoutDup,
      {
        feedIngredientId: addIngredient.feedIngredientId,
        pricePerKg: addIngredient.pricePerKg,
        maxAvailableKg: addIngredient.maxAvailableKg
      }
    ];
    const nextNutrition = {
      ...baseInput.nutritionById,
      [addIngredient.feedIngredientId]: addIngredient.nutrition
    };
    delete nextNutrition[removeIngredientId];

    const substituted = this.formulate({
      ...baseInput,
      availableIngredients: nextAvailable,
      nutritionById: nextNutrition
    });

    let nutritionDelta: SubstitutionResult["nutritionDelta"] = null;
    if (
      base.feasible &&
      substituted.feasible &&
      base.nutritionResult &&
      substituted.nutritionResult
    ) {
      const b = base.nutritionResult;
      const s = substituted.nutritionResult;
      const energyChangePct =
        b.metabolizableEnergyKcal > 0
          ? ((s.metabolizableEnergyKcal - b.metabolizableEnergyKcal) /
              b.metabolizableEnergyKcal) *
            100
          : null;
      nutritionDelta = {
        crudeProteinPct: s.crudeProteinPct - b.crudeProteinPct,
        metabolizableEnergyKcal:
          s.metabolizableEnergyKcal - b.metabolizableEnergyKcal,
        lysinePct: s.lysinePct - b.lysinePct,
        methioninePct: s.methioninePct - b.methioninePct,
        calciumPct: s.calciumPct - b.calciumPct,
        phosphorusPct: s.phosphorusPct - b.phosphorusPct,
        crudeFiberPct: s.crudeFiberPct - b.crudeFiberPct,
        energyChangePct:
          energyChangePct == null ? null : round(energyChangePct, 4)
      };
    }

    return {
      ...substituted,
      nutritionDelta,
      baseFeasible: base.feasible
    };
  }
}

type Candidate = {
  varId: string;
  feedIngredientId: string;
  pricePerKg: number;
  maxProp: number;
  nutrition: IngredientNutrition;
};

function prepareCandidates(
  available: AvailableIngredientInput[],
  nutritionById: Record<string, IngredientNutrition>,
  totalFeedKg: number,
  warnings: string[]
): Candidate[] {
  const out: Candidate[] = [];
  let i = 0;
  for (const a of available) {
    const n = nutritionById[a.feedIngredientId];
    if (!n) {
      warnings.push(
        `Intrant ${a.feedIngredientId} ignoré : nutrition manquante.`
      );
      continue;
    }
    if (!(a.pricePerKg >= 0) || !Number.isFinite(a.pricePerKg)) {
      warnings.push(
        `Intrant ${a.feedIngredientId} ignoré : prix/kg invalide.`
      );
      continue;
    }
    if (!(a.maxAvailableKg > 0) || !Number.isFinite(a.maxAvailableKg)) {
      warnings.push(
        `Intrant ${a.feedIngredientId} ignoré : stock disponible nul.`
      );
      continue;
    }
    const maxProp = Math.min(1, a.maxAvailableKg / totalFeedKg);
    if (maxProp <= 1e-12) {
      warnings.push(
        `Intrant ${a.feedIngredientId} ignoré : stock insuffisant vs besoin total.`
      );
      continue;
    }
    out.push({
      varId: `x${i++}`,
      feedIngredientId: a.feedIngredientId,
      pricePerKg: a.pricePerKg,
      maxProp,
      nutrition: n
    });
  }
  return out;
}

function buildLpModel(
  candidates: Candidate[],
  profile: RequirementProfileSnapshot,
  _totalFeedKg: number
) {
  const constraints: Record<
    string,
    { min?: number; max?: number; equal?: number }
  > = {
    mix: { equal: 1 },
    crudeProtein: { min: profile.minCrudeProteinPct },
    energy: { min: profile.minMetabolizableEnergyKcal },
    lysine: { min: profile.minLysinePct },
    methionine: { min: profile.minMethioninePct },
    calcium: { min: profile.minCalciumPct },
    phosphorus: { min: profile.minPhosphorusPct }
  };
  if (profile.maxCrudeProteinPct != null) {
    constraints.crudeProtein.max = profile.maxCrudeProteinPct;
  }
  if (profile.maxMetabolizableEnergyKcal != null) {
    constraints.energy.max = profile.maxMetabolizableEnergyKcal;
  }
  if (profile.maxCalciumPct != null) {
    constraints.calcium.max = profile.maxCalciumPct;
  }
  if (profile.maxFiberPct != null) {
    constraints.fiber = { max: profile.maxFiberPct };
  }
  if (profile.minLysinePerMcal != null) {
    // sum(coeff_i × x_i) ≥ 0
    constraints.lysEnergy = { min: 0 };
  }

  const variables: Record<string, Record<string, number>> = {};
  for (const c of candidates) {
    const n = c.nutrition;
    const v: Record<string, number> = {
      cost: c.pricePerKg,
      mix: 1,
      crudeProtein: n.crudeProteinPct,
      energy: n.metabolizableEnergyKcal,
      lysine: n.lysinePct,
      methionine: n.methioninePct,
      calcium: n.calciumPct,
      phosphorus: n.phosphorusPct,
      fiber: n.crudeFiberPct,
      [`cap_${c.varId}`]: 1
    };
    if (profile.minLysinePerMcal != null) {
      v.lysEnergy = lysineEnergyCoeff(
        n.lysinePct,
        n.metabolizableEnergyKcal,
        profile.minLysinePerMcal
      );
    }
    variables[c.varId] = v;
    constraints[`cap_${c.varId}`] = { max: c.maxProp };
  }

  return {
    objective: "cost",
    sense: "min" as const,
    constraints,
    variables
  };
}

/**
 * Diagnostique les nutriments non atteignables (LP mono-objectif max/min).
 */
function diagnoseInfeasibility(
  solver: SolverPort,
  candidates: Candidate[],
  profile: RequirementProfileSnapshot,
  totalFeedKg: number
): string[] {
  const reasons: string[] = [];
  const totalAvail = candidates.reduce(
    (s, c) => s + c.maxProp * totalFeedKg,
    0
  );
  if (totalAvail + 1e-6 < totalFeedKg) {
    reasons.push(
      `Stock total insuffisant : ${round(totalAvail, 2)} kg disponibles pour ${round(totalFeedKg, 2)} kg requis.`
    );
  }

  const mins: Array<{
    key: string;
    label: string;
    min: number;
    getter: (n: IngredientNutrition) => number;
    hint: string;
  }> = [
    {
      key: "crudeProtein",
      label: "protéine brute",
      min: profile.minCrudeProteinPct,
      getter: (n) => n.crudeProteinPct,
      hint: "protéagineux (tourteau, farine de poisson, etc.)"
    },
    {
      key: "energy",
      label: "énergie métabolisable",
      min: profile.minMetabolizableEnergyKcal,
      getter: (n) => n.metabolizableEnergyKcal,
      hint: "céréales énergétiques (maïs, manioc, etc.)"
    },
    {
      key: "lysine",
      label: "lysine",
      min: profile.minLysinePct,
      getter: (n) => n.lysinePct,
      hint: "sources riches en lysine (tourteau soja, L-lysine, farine poisson)"
    },
    {
      key: "methionine",
      label: "méthionine",
      min: profile.minMethioninePct,
      getter: (n) => n.methioninePct,
      hint: "sources méthionine (tourteau, DL-méthionine)"
    },
    {
      key: "calcium",
      label: "calcium",
      min: profile.minCalciumPct,
      getter: (n) => n.calciumPct,
      hint: "minéraux calciques (carbonate de calcium, coquillages)"
    },
    {
      key: "phosphorus",
      label: "phosphore",
      min: profile.minPhosphorusPct,
      getter: (n) => n.phosphorusPct,
      hint: "sources phosphorées (phosphate bicalcique, sons)"
    }
  ];

  for (const m of mins) {
    const maxReach = extremumNutrient(solver, candidates, m.getter, "max");
    if (maxReach != null && maxReach + 1e-6 < m.min) {
      reasons.push(
        `Impossible d'atteindre le minimum de ${m.label} (${m.min}) : maximum réalisable ≈ ${round(maxReach, 4)} avec les intrants disponibles — il manque probablement un ${m.hint}.`
      );
    }
  }

  if (profile.maxMetabolizableEnergyKcal != null) {
    const minReach = extremumNutrient(
      solver,
      candidates,
      (n) => n.metabolizableEnergyKcal,
      "min"
    );
    if (
      minReach != null &&
      minReach - 1e-6 > profile.maxMetabolizableEnergyKcal
    ) {
      reasons.push(
        `Impossible de respecter le plafond énergétique anti-gras (${profile.maxMetabolizableEnergyKcal} kcal/kg) : minimum réalisable ≈ ${round(minReach, 2)} — ajouter des intrants moins caloriques (sons, fibres).`
      );
    }
  }

  if (profile.maxFiberPct != null) {
    const minFiber = extremumNutrient(
      solver,
      candidates,
      (n) => n.crudeFiberPct,
      "min"
    );
    if (minFiber != null && minFiber - 1e-6 > profile.maxFiberPct) {
      reasons.push(
        `Impossible de respecter le plafond de cellulose (${profile.maxFiberPct} %) : minimum ≈ ${round(minFiber, 4)} — réduire les co-produits fibreux.`
      );
    }
  }

  if (profile.minLysinePerMcal != null) {
    const maxRatio = extremumLysineEnergy(solver, candidates);
    if (
      maxRatio != null &&
      maxRatio + 1e-6 < profile.minLysinePerMcal
    ) {
      reasons.push(
        `Impossible d'atteindre le ratio lysine/énergie anti-gras (≥ ${profile.minLysinePerMcal} g/Mcal) : maximum ≈ ${round(maxRatio, 4)} — manquent des sources riches en lysine ou trop d'énergie dense.`
      );
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      "Combinaison de contraintes incompatible avec les intrants et stocks disponibles (aucun nutriment isolé insuffisant détecté)."
    );
  }
  return reasons;
}

function extremumNutrient(
  solver: SolverPort,
  candidates: Candidate[],
  getter: (n: IngredientNutrition) => number,
  sense: "min" | "max"
): number | null {
  const constraints: Record<
    string,
    { min?: number; max?: number; equal?: number }
  > = { mix: { equal: 1 } };
  const variables: Record<string, Record<string, number>> = {};
  for (const c of candidates) {
    variables[c.varId] = {
      obj: getter(c.nutrition),
      mix: 1,
      [`cap_${c.varId}`]: 1
    };
    constraints[`cap_${c.varId}`] = { max: c.maxProp };
  }
  const sol = solver.solve({
    objective: "obj",
    sense,
    constraints,
    variables
  });
  if (!sol.feasible) return null;
  return sol.objectiveValue;
}

/** Maximise approx. le ratio lysine/énergie via LP sur le coeff linéaire. */
function extremumLysineEnergy(
  solver: SolverPort,
  candidates: Candidate[]
): number | null {
  // Maximise sum(lys×x) puis évalue le ratio sur la solution ;
  // si EM peut être très basse, on maximise aussi lysEnergy avec R=0 (pure lys).
  const constraints: Record<
    string,
    { min?: number; max?: number; equal?: number }
  > = { mix: { equal: 1 } };
  const variables: Record<string, Record<string, number>> = {};
  for (const c of candidates) {
    variables[c.varId] = {
      obj: c.nutrition.lysinePct,
      mix: 1,
      energy: c.nutrition.metabolizableEnergyKcal,
      [`cap_${c.varId}`]: 1
    };
    constraints[`cap_${c.varId}`] = { max: c.maxProp };
  }
  const sol = solver.solve({
    objective: "obj",
    sense: "max",
    constraints,
    variables
  });
  if (!sol.feasible) return null;
  let lys = 0;
  let me = 0;
  for (const c of candidates) {
    const p = sol.values[c.varId] ?? 0;
    lys += p * c.nutrition.lysinePct;
    me += p * c.nutrition.metabolizableEnergyKcal;
  }
  if (me <= 1e-9) return null;
  return (10_000 * lys) / me;
}

function validateInput(input: FormulateInput): string | null {
  if (!(input.animalCount > 0)) {
    return "animalCount doit être > 0.";
  }
  if (!(input.avgWeightKg > 0)) {
    return "avgWeightKg doit être > 0.";
  }
  if (!(input.durationDays > 0)) {
    return "durationDays doit être > 0.";
  }
  if (input.profile.stage !== input.stage) {
    return "Le profil nutritionnel ne correspond pas au stade demandé.";
  }
  if (!input.profile) {
    return "Profil de besoins manquant.";
  }
  return null;
}

function emptyInfeasible(
  reasons: string[],
  warnings: string[]
): FormulateResult {
  return {
    feasible: false,
    ration: [],
    totalFeedKg: 0,
    dailyIntakeKg: 0,
    totalCostXof: 0,
    costPerKg: 0,
    nutritionResult: null,
    deviations: [],
    warnings,
    infeasibilityReasons: reasons
  };
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
