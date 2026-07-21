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
  /** Chips filtre consultations / search. */
  oliveChipBg: "#E8EFD9",
  olivePlaceholder: "#9AA088",
  oliveOnlineBg: "#E8F5E4",
  oliveOnlineFg: "#2D5016",
  oliveOnlineDot: "#43A047",
  oliveNeutralBg: "#EDECE4",
  oliveComposerBorder: "#4A6118",
  oliveBannerBorder: "#D4E8D0",
  dangerSoftBg: "#FDECEA",
  errorSoftBg: "#FEF2F2",
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
  /** Pastels KPI / finance (déjà en dur sur écrans producteur). */
  kpiBlue: "#E3F2FD",
  kpiGreen: "#E8F5E9",
  kpiAmber: "#FFF8E6",
  kpiAmberSoft: "#FEF3C7",
  kpiRose: "#FFEBEE",
  kpiOlive: "#EEF4DC",
  financeIndigoBg: "#E0E7FF",
  financeIndigoText: "#3730A3",
  chartOrange: "#F97316",
  chartBlue: "#3B82F6",
  chartYellow: "#EAB308",
  chartGreen: "#22C55E",
  /** Modules FarmDetail (couleurs déjà en dur par tuile). */
  moduleTealBorder: "#4A90A4",
  moduleTealBg: "#EEF6F8",
  moduleIndigoBorder: "#6B7CB8",
  moduleIndigoBg: "#F2F4FB",
  moduleIndigoText: "#3D4D78",
  moduleBrownBorder: "#A67C52",
  moduleBrownText: "#5C4428",
  moduleSlateBorder: "#6B6E9C",
  moduleSlateBg: "#F4F4FB",
  moduleSlateText: "#3A3D6B",
  moduleLimeBorder: "#8FAA3C",
  moduleLimeText: "#4D6318",
  memberChipBg: "#EEF6D8",
  memberChipBorder: "#C5D99A",
  memberCardBorder: "#E8E6D8",
  successMintBg: "#ECFDF5",
  dangerStrong: "#B91C1C",
  coralBorder: "#C47A6A",
  /** Marque Telegram (écran Support). */
  telegram: "#229ED9",
  telegramSoft: "#229ED918"
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
