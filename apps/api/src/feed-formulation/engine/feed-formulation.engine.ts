import type { SolverPort } from "../solver/solver.port";
import { resolveDailyIntakeKg } from "./daily-intake";
import {
  FIXED_INCLUSIONS_WARN_THRESHOLD_PCT,
  parseFixedInclusions,
  sumFixedInclusionPct,
  type FixedInclusion
} from "./fixed-inclusions";
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

type FixedNutritionContrib = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  lysEnergy: number;
};

/**
 * Moteur pur de formulation au moindre coût.
 * Aucun I/O — reçoit profil + nutrition + disponibilités déjà résolus.
 *
 * Solveur en deux temps :
 * 1) pose les taux fixes du stade (CMV, sel…) ;
 * 2) optimise les intrants variables sur la masse restante.
 * Les apports des prémélanges COMPTENT dans le bilan (sinon sur-dosage Ca/P).
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

    const fixedList = parseFixedInclusions(input.profile.fixedInclusions);
    const sumFixedPct = sumFixedInclusionPct(fixedList);
    if (sumFixedPct > FIXED_INCLUSIONS_WARN_THRESHOLD_PCT) {
      warnings.push(
        `Taux fixes du stade élevés (${round(sumFixedPct, 2)} % > ${FIXED_INCLUSIONS_WARN_THRESHOLD_PCT} %) — vérifiez la saisie admin (probable erreur).`
      );
    }
    if (sumFixedPct >= 100 - 1e-9) {
      return emptyInfeasible(
        [
          `Somme des taux fixes (${round(sumFixedPct, 2)} %) ≥ 100 % — impossible de formuler.`
        ],
        warnings
      );
    }

    const fixedResolved = resolveFixedInclusions(
      fixedList,
      input.availableIngredients,
      input.nutritionById,
      totalFeedKg,
      input.profile.minLysinePerMcal,
      warnings
    );
    if (fixedResolved.error) {
      return emptyInfeasible([fixedResolved.error], warnings);
    }

    const fixedProps = fixedResolved.proportions;
    const remaining = 1 - fixedResolved.sumProp;
    const fixedContrib = fixedResolved.contrib;

    // Variables = disponibles hors taux fixes, hors prémélanges (isPremix).
    const fixedIds = new Set(Object.keys(fixedProps));
    const variableAvailable = input.availableIngredients.filter((a) => {
      if (fixedIds.has(a.feedIngredientId)) return false;
      const n = input.nutritionById[a.feedIngredientId];
      if (n?.isPremix) {
        warnings.push(
          `Prémélange « ${n.canonicalName ?? a.feedIngredientId} » disponible mais non prescrit dans les taux fixes du stade — ignoré (hors optimisation).`
        );
        return false;
      }
      return true;
    });

    if (remaining <= 1e-12) {
      return finalizeRation({
        proportions: fixedProps,
        totalFeedKg,
        dailyIntakeKg,
        input,
        availableForPrice: input.availableIngredients,
        warnings
      });
    }

    if (variableAvailable.length === 0) {
      return emptyInfeasible(
        [
          "Aucun intrant variable disponible pour compléter la ration après les taux fixes (CMV/sel…)."
        ],
        warnings
      );
    }

    const candidates = prepareCandidates(
      variableAvailable,
      input.nutritionById,
      totalFeedKg,
      warnings
    );
    if (candidates.length === 0) {
      return emptyInfeasible(
        [
          "Aucun intrant variable valide (stock/prix) pour formuler la part restante de la ration."
        ],
        warnings
      );
    }

    // Capacité stock : chaque variable ne peut pas dépasser remaining.
    for (const c of candidates) {
      c.maxProp = Math.min(c.maxProp, remaining);
    }

    const model = buildLpModel(
      candidates,
      input.profile,
      remaining,
      fixedContrib
    );
    const solution = this.solver.solve(model);

    if (!solution.feasible) {
      const reasons = diagnoseInfeasibility(
        this.solver,
        candidates,
        input.profile,
        totalFeedKg,
        remaining,
        fixedContrib
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

    const proportions: Record<string, number> = { ...fixedProps };
    let sumVar = 0;
    for (const c of candidates) {
      const p = solution.values[c.varId] ?? 0;
      if (p > 1e-12) {
        proportions[c.feedIngredientId] = (proportions[c.feedIngredientId] ?? 0) + p;
        sumVar += p;
      }
    }

    // Renormalisation légère sur la part variable uniquement si écart mineur.
    if (sumVar > 0 && Math.abs(sumVar - remaining) > 1e-6) {
      const scale = remaining / sumVar;
      for (const c of candidates) {
        if (proportions[c.feedIngredientId] != null && !fixedIds.has(c.feedIngredientId)) {
          proportions[c.feedIngredientId]! *= scale;
        }
      }
      // Remettre les fixes intacts.
      for (const [id, p] of Object.entries(fixedProps)) {
        proportions[id] = p;
      }
      warnings.push(
        "Proportions variables renormalisées après résolution (écart numérique mineur)."
      );
    }

    return finalizeRation({
      proportions,
      totalFeedKg,
      dailyIntakeKg,
      input,
      availableForPrice: input.availableIngredients,
      warnings
    });
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

function resolveFixedInclusions(
  fixedList: FixedInclusion[],
  available: AvailableIngredientInput[],
  nutritionById: Record<string, IngredientNutrition>,
  totalFeedKg: number,
  minLysinePerMcal: number | null,
  warnings: string[]
): {
  proportions: Record<string, number>;
  sumProp: number;
  contrib: FixedNutritionContrib;
  error?: string;
} {
  const availById = new Map(available.map((a) => [a.feedIngredientId, a]));
  const proportions: Record<string, number> = {};
  let sumProp = 0;
  const contrib: FixedNutritionContrib = {
    crudeProteinPct: 0,
    metabolizableEnergyKcal: 0,
    lysinePct: 0,
    methioninePct: 0,
    calciumPct: 0,
    phosphorusPct: 0,
    crudeFiberPct: 0,
    lysEnergy: 0
  };

  for (const fi of fixedList) {
    const prop = fi.inclusionPct / 100;
    const n = nutritionById[fi.feedIngredientId];
    const a = availById.get(fi.feedIngredientId);
    if (!n) {
      return {
        proportions: {},
        sumProp: 0,
        contrib,
        error: `Taux fixe : nutrition manquante pour l'intrant ${fi.feedIngredientId}.`
      };
    }
    if (!a) {
      return {
        proportions: {},
        sumProp: 0,
        contrib,
        error: `Taux fixe prescrit pour « ${n.canonicalName ?? fi.feedIngredientId} » (${fi.inclusionPct} %) mais cet intrant n'est pas disponible pour la formulation.`
      };
    }
    const needKg = prop * totalFeedKg;
    if (a.maxAvailableKg + 1e-9 < needKg) {
      return {
        proportions: {},
        sumProp: 0,
        contrib,
        error: `Stock insuffisant pour le taux fixe de « ${n.canonicalName ?? fi.feedIngredientId} » : ${round(needKg, 2)} kg requis, ${round(a.maxAvailableKg, 2)} kg dispo.`
      };
    }
    if (!(a.pricePerKg >= 0) || !Number.isFinite(a.pricePerKg)) {
      warnings.push(
        `Prix/kg invalide pour le taux fixe « ${n.canonicalName ?? fi.feedIngredientId} » — coût forcé à 0.`
      );
    }
    proportions[fi.feedIngredientId] = prop;
    sumProp += prop;
    contrib.crudeProteinPct += prop * n.crudeProteinPct;
    contrib.metabolizableEnergyKcal += prop * n.metabolizableEnergyKcal;
    contrib.lysinePct += prop * n.lysinePct;
    contrib.methioninePct += prop * n.methioninePct;
    contrib.calciumPct += prop * n.calciumPct;
    contrib.phosphorusPct += prop * n.phosphorusPct;
    contrib.crudeFiberPct += prop * n.crudeFiberPct;
    if (minLysinePerMcal != null) {
      contrib.lysEnergy +=
        prop *
        lysineEnergyCoeff(
          n.lysinePct,
          n.metabolizableEnergyKcal,
          minLysinePerMcal
        );
    }
  }

  return { proportions, sumProp, contrib };
}

function finalizeRation(args: {
  proportions: Record<string, number>;
  totalFeedKg: number;
  dailyIntakeKg: number;
  input: FormulateInput;
  availableForPrice: AvailableIngredientInput[];
  warnings: string[];
}): FormulateResult {
  const {
    proportions,
    totalFeedKg,
    dailyIntakeKg,
    input,
    availableForPrice,
    warnings
  } = args;

  // Renormalisation globale mineure pour somme = 1.
  let sumP = Object.values(proportions).reduce((s, p) => s + p, 0);
  if (sumP > 0 && Math.abs(sumP - 1) > 1e-6) {
    for (const id of Object.keys(proportions)) {
      proportions[id]! /= sumP;
    }
    warnings.push(
      "Proportions renormalisées après assemblage (écart numérique mineur)."
    );
    sumP = 1;
  }

  const nutrition = roundNutrition(
    blendNutrition(proportions, input.nutritionById)
  );
  const deviations = evaluateDeviations(input.profile, nutrition);

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
        "La ration (taux fixes + optimisation) ne respecte pas les bornes nutritionnelles après contrôle (sécurité).",
        ...outOfBounds.map(
          (d) =>
            `${d.nutrient} = ${d.actual.toFixed(4)} (cible ${d.target})`
        )
      ]
    };
  }

  const priceById = new Map(
    availableForPrice.map((a) => [a.feedIngredientId, a.pricePerKg])
  );

  const ration = Object.entries(proportions)
    .map(([feedIngredientId, p]) => {
      const quantityKg = p * totalFeedKg;
      const price = priceById.get(feedIngredientId) ?? 0;
      const name = input.nutritionById[feedIngredientId]?.canonicalName;
      return {
        feedIngredientId,
        ...(name ? { canonicalName: name } : {}),
        quantityKg: round(quantityKg, QTY_DIGITS),
        proportionPct: round(p * 100, 4),
        costContribution: round(quantityKg * Math.max(0, price), COST_DIGITS)
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

/**
 * LP sur la masse restante uniquement.
 * Contrainte nutriment : sum(v_j × n_j) ≥ min − apport_fixe
 * (idem pour les plafonds). Couplage documenté : les prémélanges comptent.
 */
function buildLpModel(
  candidates: Candidate[],
  profile: RequirementProfileSnapshot,
  remaining: number,
  fixed: FixedNutritionContrib
) {
  const constraints: Record<
    string,
    { min?: number; max?: number; equal?: number }
  > = {
    mix: { equal: remaining },
    crudeProtein: { min: profile.minCrudeProteinPct - fixed.crudeProteinPct },
    energy: {
      min: profile.minMetabolizableEnergyKcal - fixed.metabolizableEnergyKcal
    },
    lysine: { min: profile.minLysinePct - fixed.lysinePct },
    methionine: { min: profile.minMethioninePct - fixed.methioninePct },
    calcium: { min: profile.minCalciumPct - fixed.calciumPct },
    phosphorus: { min: profile.minPhosphorusPct - fixed.phosphorusPct }
  };
  if (profile.maxCrudeProteinPct != null) {
    constraints.crudeProtein.max =
      profile.maxCrudeProteinPct - fixed.crudeProteinPct;
  }
  if (profile.maxMetabolizableEnergyKcal != null) {
    constraints.energy.max =
      profile.maxMetabolizableEnergyKcal - fixed.metabolizableEnergyKcal;
  }
  if (profile.maxCalciumPct != null) {
    constraints.calcium.max = profile.maxCalciumPct - fixed.calciumPct;
  }
  if (profile.maxFiberPct != null) {
    constraints.fiber = { max: profile.maxFiberPct - fixed.crudeFiberPct };
  }
  if (profile.minLysinePerMcal != null) {
    // sum_all coeff×prop ≥ 0  ⇒  sum_var coeff×v ≥ −sum_fixed coeff×f
    constraints.lysEnergy = { min: -fixed.lysEnergy };
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
 * Diagnostique les nutriments non atteignables (LP mono-objectif max/min)
 * sur la part variable, en tenant compte des apports fixes.
 */
function diagnoseInfeasibility(
  solver: SolverPort,
  candidates: Candidate[],
  profile: RequirementProfileSnapshot,
  totalFeedKg: number,
  remaining: number,
  fixed: FixedNutritionContrib
): string[] {
  const reasons: string[] = [];
  const totalAvail =
    fixed.crudeProteinPct >= 0
      ? candidates.reduce((s, c) => s + c.maxProp * totalFeedKg, 0) +
        /* part fixe déjà réservée */ (1 - remaining) * totalFeedKg
      : candidates.reduce((s, c) => s + c.maxProp * totalFeedKg, 0);

  // Stock variable + masse fixe déjà posée.
  const varAvail = candidates.reduce((s, c) => s + c.maxProp * totalFeedKg, 0);
  if (varAvail + 1e-6 < remaining * totalFeedKg) {
    reasons.push(
      `Stock variable insuffisant : ${round(varAvail, 2)} kg pour ${round(remaining * totalFeedKg, 2)} kg restants après taux fixes.`
    );
  }
  void totalAvail;

  const mins: Array<{
    label: string;
    minNeededFromVar: number;
    getter: (n: IngredientNutrition) => number;
    hint: string;
  }> = [
    {
      label: "protéine brute",
      minNeededFromVar: profile.minCrudeProteinPct - fixed.crudeProteinPct,
      getter: (n) => n.crudeProteinPct,
      hint: "protéagineux (tourteau, farine de poisson, etc.)"
    },
    {
      label: "énergie métabolisable",
      minNeededFromVar:
        profile.minMetabolizableEnergyKcal - fixed.metabolizableEnergyKcal,
      getter: (n) => n.metabolizableEnergyKcal,
      hint: "céréales énergétiques (maïs, manioc, etc.)"
    },
    {
      label: "lysine",
      minNeededFromVar: profile.minLysinePct - fixed.lysinePct,
      getter: (n) => n.lysinePct,
      hint: "sources riches en lysine (tourteau soja, L-lysine, farine poisson)"
    },
    {
      label: "méthionine",
      minNeededFromVar: profile.minMethioninePct - fixed.methioninePct,
      getter: (n) => n.methioninePct,
      hint: "sources méthionine (tourteau, DL-méthionine)"
    },
    {
      label: "calcium",
      minNeededFromVar: profile.minCalciumPct - fixed.calciumPct,
      getter: (n) => n.calciumPct,
      hint: "minéraux calciques (carbonate de calcium, coquillages)"
    },
    {
      label: "phosphore",
      minNeededFromVar: profile.minPhosphorusPct - fixed.phosphorusPct,
      getter: (n) => n.phosphorusPct,
      hint: "sources phosphorées (phosphate bicalcique, sons)"
    }
  ];

  for (const m of mins) {
    if (m.minNeededFromVar <= 0) continue; // déjà couvert par les fixes
    const maxReach = extremumNutrient(
      solver,
      candidates,
      m.getter,
      "max",
      remaining
    );
    if (maxReach != null && maxReach + 1e-6 < m.minNeededFromVar) {
      reasons.push(
        `Impossible d'atteindre le minimum de ${m.label} (reste à couvrir ${round(m.minNeededFromVar, 4)} après taux fixes) : maximum réalisable ≈ ${round(maxReach, 4)} — il manque probablement un ${m.hint}.`
      );
    }
  }

  if (profile.maxMetabolizableEnergyKcal != null) {
    const maxAllowedFromVar =
      profile.maxMetabolizableEnergyKcal - fixed.metabolizableEnergyKcal;
    const minReach = extremumNutrient(
      solver,
      candidates,
      (n) => n.metabolizableEnergyKcal,
      "min",
      remaining
    );
    if (minReach != null && minReach - 1e-6 > maxAllowedFromVar) {
      reasons.push(
        `Impossible de respecter le plafond énergétique anti-gras (${profile.maxMetabolizableEnergyKcal} kcal/kg, dont ${round(fixed.metabolizableEnergyKcal, 2)} déjà apportés par les taux fixes) : minimum variable ≈ ${round(minReach, 2)}.`
      );
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      "Combinaison de contraintes incompatible avec les intrants, stocks et taux fixes disponibles."
    );
  }
  return reasons;
}

function extremumNutrient(
  solver: SolverPort,
  candidates: Candidate[],
  getter: (n: IngredientNutrition) => number,
  sense: "min" | "max",
  remaining: number
): number | null {
  const constraints: Record<
    string,
    { min?: number; max?: number; equal?: number }
  > = { mix: { equal: remaining } };
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
