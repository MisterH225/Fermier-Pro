import type { TrustScoreLevel } from "../../lib/api/trustScore";
import { uiNamedColors } from "../../theme/uiNamedColors";

export type TrustLevelPresentation = {
  id: TrustScoreLevel;
  icon: string;
  tint: string;
};

/** Présentation visuelle des 5 niveaux trust-score v2 (faits météo, sans jugement). */
export const TRUST_LEVEL_PRESENTATION: Record<
  TrustScoreLevel,
  TrustLevelPresentation
> = {
  ensoleille: { id: "ensoleille", icon: "☀️", tint: "#FB8C00" },
  eclaircies: { id: "eclaircies", icon: "🌤️", tint: "#43A047" },
  nuageux: { id: "nuageux", icon: "☁️", tint: "#90A4AE" },
  orageux: { id: "orageux", icon: "⛈️", tint: "#546E7A" },
  nouvelle: { id: "nouvelle", icon: "🌤️", tint: uiNamedColors.c9E9E9E }
};

export const TRUST_LEVEL_ORDER: TrustScoreLevel[] = [
  "ensoleille",
  "eclaircies",
  "nuageux",
  "orageux",
  "nouvelle"
];

export function getTrustLevelPresentation(
  level: TrustScoreLevel | string | null | undefined
): TrustLevelPresentation {
  if (level && level in TRUST_LEVEL_PRESENTATION) {
    return TRUST_LEVEL_PRESENTATION[level as TrustScoreLevel];
  }
  return TRUST_LEVEL_PRESENTATION.nouvelle;
}
