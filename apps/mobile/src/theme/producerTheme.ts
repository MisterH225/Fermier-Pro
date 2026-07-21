import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "./mobileTheme";

/**
 * Thème producteur — formalise les couleurs déjà dominantes dans screens/
 * (vert accent + olive marketplace), sans nouvelle identité visuelle.
 */
export const producerColors = {
  /** Vert producteur (mobileColors.accent — CTA / navigation). */
  primary: mobileColors.accent,
  primarySoft: "#7A9A3A",
  primaryLight: mobileColors.accentSoft,
  primaryMuted: "#DFE8C8",
  primaryDark: "#3D5218",
  /** Olive marketplace (annonces / listes producteur). */
  olive: "#5D7A1F",
  oliveDark: "#1F2910",
  oliveMuted: "#6D745B",
  oliveBorder: "#E0E4D4",
  oliveBorderWarm: "#E8E4D4",
  oliveWash: "#F0F5E4",
  oliveWashSoft: "#EEF4DC",
  oliveCanvas: "#F6F9E8",
  oliveCard: "#FDFCF5",
  oliveInk: "#4A5238",
  oliveInkMuted: "#A8A99A",
  oliveClosedText: "#6B5420",
  secondary: "#F6F9E8",
  accent: "#A34C24",
  canvas: mobileColors.canvas,
  background: mobileColors.background,
  cardBg: mobileColors.background,
  onPrimary: mobileColors.onAccent,
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: "#A8A99A",
  textTertiary: mobileColors.textTertiary,
  success: mobileColors.success,
  successDeep: "#15803D",
  warning: mobileColors.warning,
  warningDeep: "#B45309",
  danger: mobileColors.error,
  /** Rouge Material déjà répandu sur écrans producteur. */
  dangerDeep: "#B00020",
  dangerAlt: "#B42318",
  border: mobileColors.border,
  modalScrim: "rgba(17, 17, 17, 0.4)",
  /** Pastels KPI (alignés usage dashboard / gestation). */
  kpiBlue: "#E3F2FD",
  kpiGreen: "#E8F5E9",
  kpiAmber: "#FFF8E6",
  kpiAmberSoft: "#FEF3C7",
  kpiRose: "#FFEBEE",
  kpiOlive: "#EEF4DC"
} as const;

export const producerRadius = {
  card: 16,
  button: 16,
  search: 16,
  pill: 999,
  day: 12,
  iconBtn: 16
} as const;

export const producerShadow = {
  card: {
    shadowColor: "#1F2910",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3
  },
  floating: {
    shadowColor: "#1F2910",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8
  },
  soft: {
    shadowColor: producerColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  }
} as const;

/** En-tête stack + fond des écrans producteur. */
export const producerStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: producerColors.cardBg },
  headerTintColor: producerColors.primary,
  headerTitleStyle: {
    fontWeight: "700",
    fontSize: 17,
    color: producerColors.textPrimary
  },
  headerShadowVisible: false,
  headerBackTitle: "",
  contentStyle: {
    backgroundColor: producerColors.canvas
  }
};
