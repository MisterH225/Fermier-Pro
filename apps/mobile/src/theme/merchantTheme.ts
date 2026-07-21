import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "./mobileTheme";

export const merchantColors = {
  primary: "#C45C26",
  primarySoft: "#E07A3D",
  primaryLight: "#FFF4ED",
  primaryDark: "#9A4218",
  secondary: "#FFF8F3",
  accent: "#E07A3D",
  canvas: "#FFF8F3",
  background: "#FFFFFF",
  cardBg: "#FFFFFF",
  onPrimary: mobileColors.onAccent,
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: "#B0A8A0",
  success: "#2E7D32",
  warning: "#FF8C00",
  danger: "#C2185B",
  border: "rgba(196, 92, 38, 0.1)",
  /** Tokens déjà en dur dans components/merchant (non-régression). */
  amberText: "#92400E",
  amberTextDeep: "#78350F",
  roseSoftBg: "#FCE4EC",
  blueSoftBg: "#DBEAFE",
  blueText: "#1E40AF",
  blueTextDeep: "#1E3A8A",
  greenText: "#047857",
  warnBannerBg: "#FFFBEB",
  orderNeutralBg: "#F3F4F6",
  orderNeutralFg: "#374151",
  orderProgressBg: "#E0F2FE",
  orderProgressFg: "#0369A1",
  orderDangerBg: "#FCE7F3"
} as const;

export const merchantRadius = { card: 22, button: 16, pill: 999 } as const;

export const merchantShadow = {
  card: {
    shadowColor: "rgba(196, 92, 38, 0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3
  },
  floating: {
    shadowColor: "rgba(196, 92, 38, 0.25)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8
  }
} as const;

export const merchantStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: merchantColors.canvas },
  headerTintColor: merchantColors.primary,
  headerTitleStyle: { fontWeight: "700" }
};
