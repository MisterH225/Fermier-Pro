import {
  PRODUCTION_STAGE_ORDER,
  productionStageLabel
} from "../constants/productionStages";
import type {
  FeedFormulateResultDto,
  FeedRationLineDto,
  ProductionStage,
  SavedCompositionStatus
} from "./api/feed-composition";

/** @deprecated Préférer PRODUCTION_STAGE_ORDER depuis constants/productionStages. */
export const PRODUCTION_STAGES: ProductionStage[] = [
  ...PRODUCTION_STAGE_ORDER
];

const STATUS_LABELS_FR: Record<SavedCompositionStatus, string> = {
  draft: "Brouillon",
  vet_review: "Chez le véto",
  validated: "Validée par le véto"
};

/** Noms techniques API → langage producteur. */
const NUTRIENT_LABELS_FR: Record<string, string> = {
  crudeProteinPct: "Protéines",
  metabolizableEnergyKcal: "Énergie",
  lysinePct: "Lysine (muscle)",
  methioninePct: "Méthionine",
  calciumPct: "Calcium (os)",
  phosphorusPct: "Phosphore",
  crudeFiberPct: "Fibres",
  lysinePerMcal: "Équilibre muscle / énergie",
  // Variantes déjà humanisées côté tests / anciennes réponses
  Protéine: "Protéines",
  EM: "Énergie",
  Lysine: "Lysine (muscle)"
};

const NUTRIENT_HINTS_FR: Record<string, string> = {
  crudeProteinPct: "c’est la « force » de l’aliment pour bien pousser",
  metabolizableEnergyKcal: "c’est ce qui fait grossir (et peut graisser si trop fort)",
  lysinePct: "aide les porcs à faire du muscle plutôt que du gras",
  methioninePct: "un autre acide aminé utile pour la croissance",
  calciumPct: "important pour les os",
  phosphorusPct: "travaille avec le calcium pour les os",
  crudeFiberPct: "trop de fibres = digestion plus lourde",
  lysinePerMcal: "pour un porc moins gras à l’engraissement / finition"
};

/**
 * Libellé stade — délègue au mapping unique `productionStages`.
 * Conservé pour compatibilité des imports existants.
 */
export function stageLabelFr(stage: ProductionStage | string): string {
  return productionStageLabel(stage);
}

export function statusLabelFr(status: SavedCompositionStatus | string): string {
  return STATUS_LABELS_FR[status as SavedCompositionStatus] ?? status;
}

export function nutrientLabelFr(nutrient: string): string {
  const key = nutrient.trim();
  return NUTRIENT_LABELS_FR[key] ?? key.replace(/Pct$/i, "").replace(/Kcal$/i, "");
}

export function nutrientHintFr(nutrient: string): string | null {
  return NUTRIENT_HINTS_FR[nutrient.trim()] ?? null;
}

/** Phrase courte pour une ligne d’écart nutritionnel. */
export function formatDeviationHuman(d: {
  nutrient: string;
  target: string;
  actual: number;
  withinBounds: boolean;
}): string {
  const name = nutrientLabelFr(d.nutrient);
  const hint = nutrientHintFr(d.nutrient);
  const value = Number.isFinite(d.actual)
    ? d.actual.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    : "—";
  if (d.withinBounds) {
    return hint
      ? `${name} : bon niveau (${value}) — ${hint}.`
      : `${name} : bon niveau (${value}).`;
  }
  return hint
    ? `${name} : à surveiller (${value}, attendu ${d.target}) — ${hint}.`
    : `${name} : à surveiller (${value}, attendu ${d.target}).`;
}

export function formatXof(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}

export function formatKg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function rationLineName(line: FeedRationLineDto): string {
  const name = line.canonicalName?.trim();
  if (name) return name;
  return "Ingrédient";
}

export function isLeanPorkStage(stage: ProductionStage | string | undefined): boolean {
  return stage === "fattening" || stage === "finishing";
}

/** Objectif « porc sans graisse » respecté si faisable + écarts OK sur stade engraissement/finition. */
export function respectsLeanPorkGoal(
  formulation: FeedFormulateResultDto | null | undefined,
  stage?: ProductionStage | string
): boolean {
  if (!formulation?.feasible || !isLeanPorkStage(stage)) return false;
  if (!formulation.deviations?.length) return true;
  return formulation.deviations.every((d) => d.withinBounds);
}

export function asRationLines(ration: unknown): FeedRationLineDto[] {
  if (!Array.isArray(ration)) return [];
  return ration.filter(
    (l): l is FeedRationLineDto =>
      l != null &&
      typeof l === "object" &&
      typeof (l as FeedRationLineDto).feedIngredientId === "string"
  );
}

/**
 * Message clair pour cas infaisable — jamais un tableau vide trompeur.
 */
export function buildInfeasibilityMessage(
  reasons: string[] | undefined
): string {
  const cleaned = (reasons ?? []).map((r) => r.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return (
      "Avec les matières premières dispo, on n’arrive pas à faire un bon mélange pour vos porcs. " +
      "Ajoutez d’autres produits (tourteau, farine de poisson…) ou regardez un aliment du commerce."
    );
  }
  const first = cleaned[0]
    .replace(/protéine brute/gi, "protéines")
    .replace(/énergie métabolisable/gi, "énergie")
    .replace(/intrants disponibles/gi, "produits disponibles");
  return (
    `On n’y arrive pas avec ce que vous avez : ${first}. ` +
    "Essayez un autre produit dans le mélange, ou un aliment du commerce."
  );
}

export function isAiUnavailableError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const e = err as { code?: string | null; status?: number; message?: string };
  if (e.code === "AI_UNAVAILABLE") return true;
  if (e.status === 503) return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("ai_unavailable") || msg.includes("assistant ia indisponible");
}
