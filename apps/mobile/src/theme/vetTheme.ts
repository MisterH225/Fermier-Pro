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
  textPrimary: "#1A1D23",
  textSecondary: "#8B95A8",
  textMuted: "#B0B8C4",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  border: "rgba(43, 127, 255, 0.08)",
  /** Créneaux agenda */
  slotAvailable: "#E8F1FF",
  slotOccupied: "#6B7280",
  slotUnavailable: "#D1D5DB",
  /** Pastels KPI accueil */
  kpiBlue: "#E3F0FF",
  kpiGreen: "#E8F8F0",
  kpiAmber: "#FFF8E6",
  kpiRose: "#FCE8F0"
} as const;

export const vetRadius = {
  card: 22,
  button: 16,
  search: 20,
  pill: 999,
  day: 14,
  iconBtn: 18
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
