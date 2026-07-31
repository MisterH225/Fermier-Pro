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
  vet_review: "En validation vétérinaire",
  validated: "Validée par le véto"
};

/**
 * Quantité journalière par animal :
 * total mélange ÷ effectif ÷ durée (jours).
 * Ex. 375 kg / 5 / 30 = 2,5 kg. Retourne 0 si données manquantes.
 */
export function computeDailyIntakeKg(
  totalFeedKg: number,
  animalCount: number | null | undefined,
  durationDays: number | null | undefined
): number {
  if (!(totalFeedKg > 0)) return 0;
  const animals =
    typeof animalCount === "number" && Number.isFinite(animalCount)
      ? animalCount
      : 0;
  const days =
    typeof durationDays === "number" && Number.isFinite(durationDays)
      ? durationDays
      : 0;
  if (!(animals > 0) || !(days > 0)) return 0;
  return totalFeedKg / animals / days;
}

/** Lit un nombre positif depuis inputParams (number ou string numérique). */
export function readPositiveInputNumber(
  params: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  if (!params) return null;
  const raw = params[key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Noms techniques API → langage producteur (labels courts, sans prose marketing). */
const NUTRIENT_LABELS_FR: Record<string, string> = {
  crudeProteinPct: "Protéines",
  metabolizableEnergyKcal: "Énergie",
  lysinePct: "Lysine (muscle)",
  methioninePct: "Méthionine",
  calciumPct: "Calcium (os)",
  phosphorusPct: "Phosphore",
  crudeFiberPct: "Fibres",
  lysinePerMcal: "Équilibre muscle / énergie",
  Protéine: "Protéines",
  EM: "Énergie",
  Lysine: "Lysine (muscle)"
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
 * Si l’API renvoie déjà un message actionnable (nutriment + type d’intrant),
 * on l’affiche tel quel ; le libellé générique « combinaison incompatible » est remplacé.
 */
export function buildInfeasibilityMessage(
  reasons: string[] | undefined
): string {
  const cleaned = (reasons ?? []).map((r) => r.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return (
      "Avec les matières premières dispo, on n’arrive pas à faire un bon mélange pour vos porcs. " +
      "Ajoutez une source de matière grasse (huile), un tourteau ou une farine de poisson, " +
      "ou utilisez un aliment du commerce adapté."
    );
  }
  const first = cleaned[0]
    .replace(/protéine brute/gi, "protéines")
    .replace(/énergie métabolisable/gi, "énergie")
    .replace(/intrants disponibles/gi, "produits disponibles")
    .replace(
      /Combinaison de contraintes incompatible.*/i,
      "les besoins de ce stade ne peuvent pas être atteints avec vos produits — " +
        "ajoutez une source manquante (huile, tourteau…), ou utilisez un aliment du commerce adapté"
    );
  // Message API déjà actionnable (nomme nutriment + type d’intrant).
  if (/ajoutez|aliment du commerce|stock insuffisant/i.test(first)) {
    return first.endsWith(".") ? first : `${first}.`;
  }
  return (
    `On n’y arrive pas avec ce que vous avez : ${first}. ` +
    "Essayez un autre produit dans le mélange, ou un aliment du commerce adapté."
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
