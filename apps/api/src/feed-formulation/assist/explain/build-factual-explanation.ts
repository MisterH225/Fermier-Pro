import type { ProductionStage } from "@prisma/client";
import type { RequirementProfileSnapshot } from "../../engine/feed-formulation.types";
import type {
  CompositionExplanation,
  DeviationForExplain,
  IngredientRoleContext,
  NutritionForExplain
} from "./composition-explanation.types";

const STAGE_LABEL_FR: Record<ProductionStage, string> = {
  piglet_weaning: "porcelets sevrés",
  growing: "porcs en croissance",
  fattening: "porcs en engraissement",
  finishing: "porcs en finition",
  gestating_sow: "truies gestantes",
  lactating_sow: "truies allaitantes"
};

/**
 * Explication factuelle minimale (sans IA) — besoins vs profil obtenu,
 * rôles des intrants. Aucune prose marketing inventée.
 */
export function buildFactualExplanation(input: {
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg?: number | null;
  avgAgeWeeks?: number | null;
  profile: RequirementProfileSnapshot;
  nutrition: NutritionForExplain;
  deviations: DeviationForExplain[];
  roles: IngredientRoleContext[];
  rationFingerprint: string;
}): CompositionExplanation {
  const stageLabel = STAGE_LABEL_FR[input.stage] ?? input.stage;
  const weightBit =
    input.avgWeightKg != null && Number.isFinite(input.avgWeightKg)
      ? ` d’environ ${fmt(input.avgWeightKg)} kg`
      : "";
  const countBit =
    input.animalCount > 0
      ? `${input.animalCount} ${stageLabel}${weightBit}`
      : stageLabel;

  const p = input.profile;
  const cpTarget =
    p.maxCrudeProteinPct != null
      ? `${fmt(p.minCrudeProteinPct)}–${fmt(p.maxCrudeProteinPct)} %`
      : `≥ ${fmt(p.minCrudeProteinPct)} %`;
  const meTarget =
    p.maxMetabolizableEnergyKcal != null
      ? `${fmt(p.minMetabolizableEnergyKcal)}–${fmt(p.maxMetabolizableEnergyKcal)} kcal/kg`
      : `≥ ${fmt(p.minMetabolizableEnergyKcal)} kcal/kg`;

  const stageNeeds =
    `Pour ${countBit}, les besoins de référence du stade sont : ` +
    `protéines ${cpTarget}, énergie ${meTarget}, ` +
    `lysine ≥ ${fmt(p.minLysinePct)} %, calcium ≥ ${fmt(p.minCalciumPct)} %, ` +
    `phosphore ≥ ${fmt(p.minPhosphorusPct)} %. ` +
    `Votre mélange atteint : protéines ${fmt(input.nutrition.crudeProteinPct)} %, ` +
    `énergie ${fmt(input.nutrition.metabolizableEnergyKcal)} kcal/kg, ` +
    `lysine ${fmt(input.nutrition.lysinePct)} %.`;

  // Intrants majeurs : ≥ 2 % ou top 6
  const majors = input.roles.filter(
    (r, i) => r.proportionPct >= 2 || i < 6
  );
  const ingredientJustifications = majors.map((r) => ({
    feedIngredientId: r.feedIngredientId,
    name: r.name,
    text:
      `${r.name} (${fmt(r.proportionPct)} %) — ${r.categoryLabelFr}` +
      (r.dominantNutrients.length
        ? ` ; apporte surtout : ${r.dominantNutrients.join(", ")}`
        : "") +
      "."
  }));

  const energyKcalPerKg = input.nutrition.metabolizableEnergyKcal;
  const energyComment = buildEnergyComment(
    input.stage,
    energyKcalPerKg,
    p.maxMetabolizableEnergyKcal ?? null,
    p.minMetabolizableEnergyKcal
  );

  const notableDeviations = dedupeNotableDeviations(input.deviations);

  return {
    stageNeeds,
    ingredientJustifications,
    energyKcalPerKg,
    energyComment,
    notableDeviations,
    source: "factual_fallback",
    rationFingerprint: input.rationFingerprint
  };
}

export function buildEnergyComment(
  stage: ProductionStage,
  energyKcal: number,
  maxMe: number | null,
  minMe: number
): string {
  const lean = stage === "fattening" || stage === "finishing";
  if (lean && maxMe != null) {
    if (energyKcal <= maxMe) {
      return (
        `Valeur énergétique totale : ${fmt(energyKcal)} kcal/kg — ` +
        `sous le plafond anti-gras du stade (${fmt(maxMe)} kcal/kg).`
      );
    }
    return (
      `Valeur énergétique totale : ${fmt(energyKcal)} kcal/kg — ` +
      `au-dessus du plafond anti-gras (${fmt(maxMe)} kcal/kg) : risque de porcs plus gras.`
    );
  }
  if (energyKcal + 1e-6 < minMe) {
    return (
      `Valeur énergétique totale : ${fmt(energyKcal)} kcal/kg — ` +
      `sous l’objectif minimum (${fmt(minMe)} kcal/kg).`
    );
  }
  return `Valeur énergétique totale : ${fmt(energyKcal)} kcal/kg.`;
}

/**
 * Une ligne par nutriment — évite la duplication min+max « bon niveau ».
 * Ne garde que les écarts hors bornes (ou résumé OK unique).
 */
export function dedupeNotableDeviations(
  deviations: DeviationForExplain[]
): string[] {
  const outOfBounds = deviations.filter((d) => !d.withinBounds);
  if (outOfBounds.length === 0) return [];

  const byNutrient = new Map<string, DeviationForExplain[]>();
  for (const d of outOfBounds) {
    const list = byNutrient.get(d.nutrient) ?? [];
    list.push(d);
    byNutrient.set(d.nutrient, list);
  }

  const lines: string[] = [];
  for (const [nutrient, list] of byNutrient) {
    const label = nutrientLabelFr(nutrient);
    const parts = list.map(
      (d) => `${fmt(d.actual)} (cible ${d.target})`
    );
    lines.push(`${label} : ${parts.join(" ; ")}.`);
  }
  return lines;
}

function nutrientLabelFr(nutrient: string): string {
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

/** Format stable (sans espaces milliers) — lisible + anti-hallucination. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}
