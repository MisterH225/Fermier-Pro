import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "./mobileTheme";

export const buyerColors = {
  primary: "#7C3AED",
  primarySoft: "#A78BFA",
  primaryLight: "#F5F0FF",
  primaryDark: "#5B21B6",
  secondary: "#FAF7FF",
  accent: "#A78BFA",
  canvas: "#FAF7FF",
  background: "#FFFFFF",
  cardBg: "#FFFFFF",
  onPrimary: mobileColors.onAccent,
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: "#B0B8C4",
  success: "#2E7D32",
  warning: "#FF8C00",
  danger: "#C2185B",
  border: "rgba(124, 58, 237, 0.08)",
  /** Pastels KPI accueil */
  kpiPurple: "#F3E8FF",
  kpiGreen: "#E8F5E9",
  kpiRose: "#FCE4EC",
  kpiAmber: "#FFF3E0"
} as const;

export const buyerRadius = { card: 22, button: 16, pill: 999 } as const;

export const buyerShadow = {
  card: {
    shadowColor: "rgba(124, 58, 237, 0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3
  },
  floating: {
    shadowColor: "rgba(124, 58, 237, 0.25)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8
  }
} as const;

export const buyerStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: buyerColors.cardBg },
  headerTintColor: buyerColors.primary,
  headerTitleStyle: { fontWeight: "700", fontSize: 17, color: buyerColors.textPrimary },
  headerShadowVisible: false,
  headerBackTitle: "",
  contentStyle: { backgroundColor: buyerColors.canvas }
};
