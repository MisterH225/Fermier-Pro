import i18n from "../i18n/i18n";
import type { ProductionStage } from "../lib/api/feed-composition";

/**
 * Mapping unique ProductionStage → libellés affichés.
 * Vocabulaire métier éleveur (CI). Les clés techniques restent inchangées.
 */

export type ProductionStageMeta = {
  /** Clé i18n du libellé court (listes, chips, titres). */
  labelKey: string;
  /** Clé i18n de la description courte optionnelle. */
  descriptionKey: string;
  /** Libellé FR de secours (si i18n pas prêt). */
  labelFr: string;
  /** Description FR de secours. */
  descriptionFr: string;
};

/** Ordre d’affichage stable dans les sélecteurs. */
export const PRODUCTION_STAGE_ORDER: readonly ProductionStage[] = [
  "piglet_weaning",
  "growing",
  "fattening",
  "finishing",
  "gestating_sow",
  "lactating_sow"
] as const;

export const PRODUCTION_STAGE_META: Record<
  ProductionStage,
  ProductionStageMeta
> = {
  piglet_weaning: {
    labelKey: "productionStages.piglet_weaning.label",
    descriptionKey: "productionStages.piglet_weaning.description",
    labelFr: "Sevrage",
    descriptionFr: "Porcelets sevrés"
  },
  growing: {
    labelKey: "productionStages.growing.label",
    descriptionKey: "productionStages.growing.description",
    labelFr: "Croissance",
    descriptionFr: "Porcs en croissance"
  },
  fattening: {
    labelKey: "productionStages.fattening.label",
    descriptionKey: "productionStages.fattening.description",
    labelFr: "Engraissement",
    descriptionFr: "Porcs en engraissement"
  },
  finishing: {
    labelKey: "productionStages.finishing.label",
    descriptionKey: "productionStages.finishing.description",
    labelFr: "Finition",
    descriptionFr: "Porcs en finition"
  },
  gestating_sow: {
    labelKey: "productionStages.gestating_sow.label",
    descriptionKey: "productionStages.gestating_sow.description",
    labelFr: "Truie gestante",
    descriptionFr: "Truie en gestation"
  },
  lactating_sow: {
    labelKey: "productionStages.lactating_sow.label",
    descriptionKey: "productionStages.lactating_sow.description",
    labelFr: "Truie allaitante",
    descriptionFr: "Truie en lactation"
  }
};

export function isProductionStage(value: string): value is ProductionStage {
  return value in PRODUCTION_STAGE_META;
}

/** Libellé court affiché partout (i18n, fallback FR). */
export function productionStageLabel(stage: ProductionStage | string): string {
  if (!isProductionStage(stage)) return stage;
  const meta = PRODUCTION_STAGE_META[stage];
  const translated = i18n.t(meta.labelKey, { defaultValue: meta.labelFr });
  return translated || meta.labelFr;
}

/** Description courte optionnelle (sous-titre, aide). */
export function productionStageDescription(
  stage: ProductionStage | string
): string {
  if (!isProductionStage(stage)) return "";
  const meta = PRODUCTION_STAGE_META[stage];
  const translated = i18n.t(meta.descriptionKey, {
    defaultValue: meta.descriptionFr
  });
  return translated || meta.descriptionFr;
}

/** Options pour sélecteurs : { value: clé enum, label }. */
export function productionStageOptions(): Array<{
  value: ProductionStage;
  label: string;
  description: string;
}> {
  return PRODUCTION_STAGE_ORDER.map((value) => ({
    value,
    label: productionStageLabel(value),
    description: productionStageDescription(value)
  }));
}
