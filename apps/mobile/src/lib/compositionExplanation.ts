import type {
  CompositionExplanationDto,
  FeedFormulateResultDto,
  FeedNutrientDeviationDto,
  FeedNutritionResultDto,
  ProductionStage
} from "./api/feed-composition";
import { asRationLines, stageLabelFr } from "./feedCompositionFormat";

/**
 * Fallback factuel local si l'API /explain échoue.
 * Jamais l'ancien gabarit « bon niveau / fait grossir ».
 */
export function buildLocalFactualExplanation(input: {
  stage: ProductionStage | string;
  animalCount?: number;
  avgWeightKg?: number;
  formulation: FeedFormulateResultDto;
}): CompositionExplanationDto | null {
  const n = input.formulation.nutritionResult;
  if (!n || !input.formulation.feasible) return null;

  const lines = asRationLines(input.formulation.ration);
  const stageLabel = stageLabelFr(input.stage);
  const weightBit =
    input.avgWeightKg != null && Number.isFinite(input.avgWeightKg)
      ? ` d’environ ${fmt(input.avgWeightKg)} kg`
      : "";
  const countBit =
    input.animalCount != null && input.animalCount > 0
      ? `${input.animalCount} animaux (${stageLabel})${weightBit}`
      : stageLabel;

  const stageNeeds =
    `Pour ${countBit} : le mélange obtenu donne ` +
    `protéines ${fmt(n.crudeProteinPct)} %, ` +
    `énergie ${fmt(n.metabolizableEnergyKcal)} kcal/kg, ` +
    `lysine ${fmt(n.lysinePct)} %, ` +
    `calcium ${fmt(n.calciumPct)} %, phosphore ${fmt(n.phosphorusPct)} %.`;

  const ingredientJustifications = lines
    .filter((l) => (l.proportionPct || 0) >= 0.2)
    .slice(0, 8)
    .map((l) => ({
      feedIngredientId: l.feedIngredientId,
      name: l.canonicalName?.trim() || "Ingrédient",
      text: `${l.canonicalName?.trim() || "Ingrédient"} : ${fmt(l.proportionPct)} % du mélange.`
    }));

  const energyKcalPerKg = n.metabolizableEnergyKcal;
  const lean =
    input.stage === "fattening" || input.stage === "finishing";
  const energyComment = lean
    ? `Valeur énergétique totale : ${fmt(energyKcalPerKg)} kcal/kg (stade ${stageLabel} — objectif porc moins gras).`
    : `Valeur énergétique totale : ${fmt(energyKcalPerKg)} kcal/kg.`;

  return {
    stageNeeds,
    ingredientJustifications,
    energyKcalPerKg,
    energyComment,
    notableDeviations: notableDeviationsOnly(input.formulation.deviations),
    source: "factual_fallback",
    rationFingerprint: "local"
  };
}

/** Une entrée par nutriment hors bornes — corrige la duplication min+max. */
export function notableDeviationsOnly(
  deviations: FeedNutrientDeviationDto[] | undefined
): string[] {
  if (!deviations?.length) return [];
  const bad = deviations.filter((d) => !d.withinBounds);
  const byNutrient = new Map<string, FeedNutrientDeviationDto[]>();
  for (const d of bad) {
    const list = byNutrient.get(d.nutrient) ?? [];
    list.push(d);
    byNutrient.set(d.nutrient, list);
  }
  const out: string[] = [];
  for (const [nutrient, list] of byNutrient) {
    const label = nutrientShort(nutrient);
    out.push(
      `${label} : ${list.map((d) => `${fmt(d.actual)} (cible ${d.target})`).join(" ; ")}.`
    );
  }
  return out;
}

export function parseCachedExplanation(
  raw: unknown
): CompositionExplanationDto | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.stageNeeds !== "string") return null;
  if (typeof o.energyKcalPerKg !== "number") return null;
  if (!Array.isArray(o.ingredientJustifications)) return null;
  return o as unknown as CompositionExplanationDto;
}

export function nutritionFromFormulation(
  f: FeedFormulateResultDto
): FeedNutritionResultDto | null {
  return f.nutritionResult;
}

function nutrientShort(nutrient: string): string {
  const map: Record<string, string> = {
    crudeProteinPct: "Protéines",
    metabolizableEnergyKcal: "Énergie",
    lysinePct: "Lysine",
    methioninePct: "Méthionine",
    calciumPct: "Calcium",
    phosphorusPct: "Phosphore",
    crudeFiberPct: "Fibres",
    lysinePerMcal: "Lysine / énergie"
  };
  return map[nutrient] ?? nutrient;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}
