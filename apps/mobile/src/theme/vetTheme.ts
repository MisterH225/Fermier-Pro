import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "./mobileTheme";

/** Thème bleu médical (#2B7FFF) — module vétérinaire (réf. maquette MedApp). */
export const vetColors = {
  primary: "#2B7FFF",
  primarySoft: "#5B9DFF",
  primaryLight: "#E8F1FF",
  primaryMuted: "#D6E8FF",
  primaryDark: "#1A5FCC",
  secondary: "#F0F4FF",
  accent: "#4ECDC4",
  canvas: "#EFF3F9",
  background: "#F5F8FC",
  cardBg: "#FFFFFF",
  onPrimary: mobileColors.onAccent,
  textPrimary: "#1A1D23",
  textSecondary: "#8B95A8",
  textMuted: "#B0B8C4",
  success: "#10B981",
  warning: "#F59E0B",
  /** Ambre soutenu (prix / CTA secondaires). */
  warningDeep: "#B45309",
  danger: "#EF4444",
  border: "rgba(43, 127, 255, 0.08)",
  modalScrim: "rgba(26, 29, 35, 0.4)",
  /** Créneaux agenda */
  slotAvailable: "#E8F1FF",
  slotOccupied: "#6B7280",
  slotUnavailable: "#D1D5DB",
  /** Pastels KPI accueil */
  kpiBlue: "#E3F0FF",
  kpiGreen: "#E8F8F0",
  kpiAmber: "#FFF8E6",
  /** Ambre clair (badges conflit / warning soft). */
  kpiAmberSoft: "#FEF3C7",
  kpiRose: "#FCE8F0"
} as const;

/** Tokens sémantiques ok / watch / alert — dossier vétérinaire uniquement. */
export const vetStatus = {
  ok: {
    key: "ok" as const,
    fg: vetColors.success,
    bg: vetColors.kpiGreen,
    icon: "checkmark-circle" as const
  },
  watch: {
    key: "watch" as const,
    fg: vetColors.warning,
    bg: vetColors.kpiAmber,
    icon: "alert-circle" as const
  },
  alert: {
    key: "alert" as const,
    fg: vetColors.danger,
    bg: vetColors.kpiRose,
    icon: "warning" as const
  }
} as const;

export type VetStatusKey = keyof typeof vetStatus;

export const vetRadius = {
  card: 20,
  button: 16,
  search: 20,
  pill: 999,
  day: 14,
  iconBtn: 18
} as const;

/**
 * Typo dossier véto.
 * Chiffres : graisse 800 (équivalent Outfit 800).
 * Libellés : 500 (équivalent Inter Medium).
 * Pas de dépendance font ajoutée — fallback système natif.
 */
export const vetType = {
  figure: {
    fontWeight: "800" as const,
    fontSize: 22,
    color: vetColors.textPrimary
  },
  figureSm: {
    fontWeight: "800" as const,
    fontSize: 16,
    color: vetColors.textPrimary
  },
  label: {
    fontWeight: "500" as const,
    fontSize: 12,
    color: vetColors.textSecondary
  },
  body: {
    fontWeight: "400" as const,
    fontSize: 14,
    color: vetColors.textPrimary
  },
  title: {
    fontWeight: "700" as const,
    fontSize: 15,
    color: vetColors.textPrimary
  }
} as const;

export const vetShadow = {
  card: {
    shadowColor: "#1A2B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3
  },
  floating: {
    shadowColor: "#1A2B4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8
  },
  soft: {
    shadowColor: "#2B7FFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  }
} as const;

/** En-tête stack + fond des écrans véto (bleu, pas vert producteur). */
export const vetStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: vetColors.cardBg },
  headerTintColor: vetColors.primary,
  headerTitleStyle: {
    fontWeight: "700",
    fontSize: 17,
    color: vetColors.textPrimary
  },
  headerShadowVisible: false,
  headerBackTitle: "",
  contentStyle: {
    backgroundColor: vetColors.canvas
  }
};
