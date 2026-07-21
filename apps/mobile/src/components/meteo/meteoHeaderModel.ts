import { uiNamedColors } from "../../theme/uiNamedColors";
import {
  getMeteoLevel,
  type MeteoLevel
} from "../../constants/meteoProfil";

/** Profils qui ont un score météo exposé en v1 (producteur uniquement). */
export type MeteoProfileType =
  | "producer"
  | "buyer"
  | "merchant"
  | "vet"
  | "technician";

const SCORED_PROFILE_TYPES = new Set<MeteoProfileType>(["producer"]);

export function profileHasMeteoScore(profileType: MeteoProfileType): boolean {
  return SCORED_PROFILE_TYPES.has(profileType);
}

export type MeteoHeaderPresentation = {
  icon: string;
  label: string;
  tint: string;
  isNew: boolean;
  accessibilityLabel: string;
};

const NEW_TINT = uiNamedColors.c9E9E9E;
const NEW_ICON = "🌤️";

/**
 * Présentation de l'icône header à partir d'un score 0–100 (agnostique v1/v2).
 * État "nouvelle" (score enum nouveau / isNew) → icône neutre sans alerte.
 */
export function resolveMeteoHeaderPresentation(input: {
  score: number | null | undefined;
  isNew?: boolean;
  /** Libellé API v1 (Excellent, Fiable…) — fallback sur le label météo. */
  apiLabel?: string | null;
}): MeteoHeaderPresentation {
  const isNew = Boolean(input.isNew);
  if (isNew || input.score == null) {
    const level = getMeteoLevel(43); // brise — neutre visuel
    return {
      icon: NEW_ICON,
      label: "Nouveau",
      tint: NEW_TINT,
      isNew: true,
      accessibilityLabel: "Météo de confiance : Nouveau"
    };
  }

  const level: MeteoLevel = getMeteoLevel(input.score);
  const label = input.apiLabel?.trim() || level.label;
  return {
    icon: level.icon,
    label,
    tint: level.card_bg,
    isNew: false,
    accessibilityLabel: `Météo de confiance : ${label}`
  };
}

/** Snapshot textuel pour tests (icône + teinte par niveau). */
export function meteoHeaderSnapshotForScore(
  score: number,
  isNew = false
): { icon: string; tint: string; label: string; isNew: boolean } {
  const p = resolveMeteoHeaderPresentation({ score, isNew });
  return {
    icon: p.icon,
    tint: p.tint,
    label: p.label,
    isNew: p.isNew
  };
}
