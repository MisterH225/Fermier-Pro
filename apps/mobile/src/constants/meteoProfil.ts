/** Système de niveaux "MétéoProfil" — remplace les anciens labels de score. */

/**
 * Clés niveau trust-score v2 (API) — mapping produit vers la météo affichée.
 * Tant que TRUST_SCORE_V2_ACTIVE=false, l'UI consomme encore le score v1 numérique.
 */
export const TRUST_SCORE_V2_LEVEL_IDS = [
  "ensoleille",
  "eclaircies",
  "nuageux",
  "orageux",
  "nouvelle"
] as const;

export type TrustScoreV2LevelId = (typeof TRUST_SCORE_V2_LEVEL_IDS)[number];

export type MeteoLevel = {
  id: string;
  /** Nom du niveau affiché à l'utilisateur */
  label: string;
  /** Emoji météo */
  icon: string;
  /** Couleur de fond de la carte */
  card_bg: string;
  /** Couleur du texte sur la carte */
  card_text: string;
  /** Message motivant court */
  message: string;
  /** Texte d'incitation vers le niveau suivant, null au dernier niveau */
  next_label: string | null;
  range_min: number;
  range_max: number;
};

export const METEO_LEVELS: MeteoLevel[] = [
  {
    id: "debutant",
    label: "Nuage gris",
    icon: "🌧️",
    card_bg: "#B0BEC5",
    card_text: "#37474F",
    message: "Commence ta première saisie — le soleil arrive.",
    next_label: "→ Éclaircie proche",
    range_min: 0,
    range_max: 20
  },
  {
    id: "eclaircie",
    label: "Éclaircie",
    icon: "⛅",
    card_bg: "#90A4AE",
    card_text: "#FFFFFF",
    message: "Bonne direction. Continue à saisir tes données.",
    next_label: "→ Prochaine étape : Brise légère",
    range_min: 21,
    range_max: 35
  },
  {
    id: "brise",
    label: "Brise légère",
    icon: "🌤️",
    card_bg: "#FFB300",
    card_text: "#FFFFFF",
    message: "Tu progresses. Ta ferme devient visible.",
    next_label: "→ Prochaine étape : Ciel dégagé",
    range_min: 36,
    range_max: 50
  },
  {
    id: "ciel_degage",
    label: "Ciel dégagé",
    icon: "🌥️",
    card_bg: "#43A047",
    card_text: "#FFFFFF",
    message: "Profil solide. Les acheteurs te font confiance.",
    next_label: "→ Prochaine étape : Grande chaleur",
    range_min: 51,
    range_max: 65
  },
  {
    id: "grande_chaleur",
    label: "Grande chaleur",
    icon: "☀️",
    card_bg: "#FB8C00",
    card_text: "#FFFFFF",
    message: "Excellente réputation. Tu rayonnes sur la plateforme.",
    next_label: "→ Prochaine étape : Soleil de plomb",
    range_min: 66,
    range_max: 79
  },
  {
    id: "soleil_plomb",
    label: "Soleil de plomb",
    icon: "🌞",
    card_bg: "#E53935",
    card_text: "#FFFFFF",
    message: "Référence de la plateforme. Ton historique parle.",
    next_label: "→ Prochaine étape : Légende",
    range_min: 80,
    range_max: 92
  },
  {
    id: "legende",
    label: "Légende",
    icon: "🌈",
    card_bg: "#6A1B9A",
    card_text: "#FFFFFF",
    message: "Sommet atteint. Tu es une référence de la filière.",
    next_label: null,
    range_min: 93,
    range_max: 100
  }
];

/**
 * Retourne le niveau MétéoProfil correspondant à un score 0–100.
 * - score null/undefined → niveau "debutant"
 * - score < 0 → niveau "debutant"
 * - score > 100 → niveau "legende"
 */
export function getMeteoLevel(score: number | null | undefined): MeteoLevel {
  if (score == null) return METEO_LEVELS[0];
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    METEO_LEVELS.find((l) => clamped >= l.range_min && clamped <= l.range_max) ??
    METEO_LEVELS[METEO_LEVELS.length - 1]
  );
}

/**
 * Convertit le score crédit acheteur (string enum) en valeur numérique 0–100
 * pour alimenter getMeteoLevel.
 *
 * Mapping métier : excellent → Soleil de plomb, bon → Grande chaleur,
 * nouveau → Brise légère, attention → Éclaircie, risque → Nuage gris.
 */
export function creditScoreToNumeric(
  score: string | null | undefined
): number {
  switch (score) {
    case "excellent": return 88;
    case "bon":       return 72;
    case "nouveau":   return 43;
    case "attention": return 28;
    case "risque":    return 10;
    default:          return 0;
  }
}

/**
 * Calcule le remplissage (0–1) de la barre de progression
 * dans le range du niveau actuel.
 */
export function getMeteoProgress(score: number | null | undefined): number {
  if (score == null) return 0;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level = getMeteoLevel(clamped);
  const range = level.range_max - level.range_min;
  if (range <= 0) return 1;
  return Math.max(0, Math.min(1, (clamped - level.range_min) / range));
}
