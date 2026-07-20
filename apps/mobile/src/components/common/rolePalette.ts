import type { ViewStyle } from "react-native";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";

export type RolePalette = {
  primary: string;
  primaryLight: string;
  canvas: string;
  cardBg: string;
  onPrimary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  radiusCard: number;
  radiusButton: number;
  radiusPill: number;
  shadowCard: ViewStyle;
};

export const buyerPalette: RolePalette = {
  primary: buyerColors.primary,
  primaryLight: buyerColors.primaryLight,
  canvas: buyerColors.canvas,
  cardBg: buyerColors.cardBg,
  onPrimary: buyerColors.onPrimary,
  textPrimary: buyerColors.textPrimary,
  textSecondary: buyerColors.textSecondary,
  textMuted: buyerColors.textMuted,
  success: buyerColors.success,
  warning: buyerColors.warning,
  danger: buyerColors.danger,
  border: buyerColors.border,
  radiusCard: buyerRadius.card,
  radiusButton: buyerRadius.button,
  radiusPill: buyerRadius.pill,
  shadowCard: buyerShadow.card
};

export const vetPalette: RolePalette = {
  primary: vetColors.primary,
  primaryLight: vetColors.primaryLight,
  canvas: vetColors.canvas,
  cardBg: vetColors.cardBg,
  onPrimary: vetColors.onPrimary,
  textPrimary: vetColors.textPrimary,
  textSecondary: vetColors.textSecondary,
  textMuted: vetColors.textMuted,
  success: vetColors.success,
  warning: vetColors.warning,
  danger: vetColors.danger,
  border: vetColors.border,
  radiusCard: vetRadius.card,
  radiusButton: vetRadius.button,
  radiusPill: vetRadius.pill,
  shadowCard: vetShadow.card
};
