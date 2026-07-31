import type {
  FeedFormulateResultDto,
  FeedRationLineDto,
  ProductionStage,
  SavedCompositionStatus
} from "./api/feed-composition";

export const PRODUCTION_STAGES: ProductionStage[] = [
  "piglet_weaning",
  "growing",
  "fattening",
  "finishing",
  "gestating_sow",
  "lactating_sow"
];

const STAGE_LABELS_FR: Record<ProductionStage, string> = {
  piglet_weaning: "Sevrage",
  growing: "Croissance",
  fattening: "Engraissement",
  finishing: "Finition",
  gestating_sow: "Truie gestante",
  lactating_sow: "Truie allaitante"
};

const STATUS_LABELS_FR: Record<SavedCompositionStatus, string> = {
  draft: "Brouillon",
  vet_review: "Chez le véto",
  validated: "Validée"
};

export function stageLabelFr(stage: ProductionStage | string): string {
  return STAGE_LABELS_FR[stage as ProductionStage] ?? stage;
}

export function statusLabelFr(status: SavedCompositionStatus | string): string {
  return STATUS_LABELS_FR[status as SavedCompositionStatus] ?? status;
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
  return "Intrant";
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
      "Les intrants disponibles ne suffisent pas pour composer cette ration. " +
      "Envisagez d’autres matières premières ou un aliment du commerce."
    );
  }
  const nutrientHint = cleaned[0] ?? "un nutriment";
  return (
    `Les intrants disponibles ne suffisent pas pour ${nutrientHint}. ` +
    "Envisagez un autre type d’intrant ou un aliment du commerce."
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
