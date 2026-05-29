import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "./mobileTheme";

export const techColors = {
  primary: "#FF6B35",
  primarySoft: "#FF8F66",
  primaryLight: "#FFF0EB",
  primaryDark: "#CC4A1A",
  secondary: "#FFF8F5",
  accent: "#FFB347",
  canvas: "#FFF8F5",
  background: "#FFFFFF",
  cardBg: "#FFFFFF",
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: "#B0B8C4",
  success: "#2E7D32",
  warning: "#BA7517",
  danger: "#E53935",
  border: "rgba(255, 107, 53, 0.08)"
} as const;

export const techRadius = { card: 22, button: 16, pill: 999 } as const;

export const techShadow = {
  card: {
    shadowColor: "rgba(255, 107, 53, 0.25)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3
  },
  floating: {
    shadowColor: "rgba(255, 107, 53, 0.25)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8
  }
} as const;

export const techStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: techColors.cardBg },
  headerTintColor: techColors.primary,
  headerTitleStyle: { fontWeight: "700", fontSize: 17, color: techColors.textPrimary },
  headerShadowVisible: false,
  headerBackTitle: "",
  contentStyle: { backgroundColor: techColors.canvas }
};
