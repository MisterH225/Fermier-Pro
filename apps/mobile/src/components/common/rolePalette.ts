import type { ViewStyle } from "react-native";
import type { ProfileType } from "@fermier/types";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import {
  merchantColors,
  merchantRadius,
  merchantShadow
} from "../../theme/merchantTheme";
import {
  producerColors,
  producerRadius,
  producerShadow
} from "../../theme/producerTheme";
import { techColors, techRadius, techShadow } from "../../theme/technicianTheme";
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

export const producerPalette: RolePalette = {
  primary: producerColors.primary,
  primaryLight: producerColors.primaryLight,
  canvas: producerColors.canvas,
  cardBg: producerColors.cardBg,
  onPrimary: producerColors.onPrimary,
  textPrimary: producerColors.textPrimary,
  textSecondary: producerColors.textSecondary,
  textMuted: producerColors.textMuted,
  success: producerColors.success,
  warning: producerColors.warning,
  danger: producerColors.danger,
  border: producerColors.border,
  radiusCard: producerRadius.card,
  radiusButton: producerRadius.button,
  radiusPill: producerRadius.pill,
  shadowCard: producerShadow.card
};

export const merchantPalette: RolePalette = {
  primary: merchantColors.primary,
  primaryLight: merchantColors.primaryLight,
  canvas: merchantColors.canvas,
  cardBg: merchantColors.cardBg,
  onPrimary: merchantColors.onPrimary,
  textPrimary: merchantColors.textPrimary,
  textSecondary: merchantColors.textSecondary,
  textMuted: merchantColors.textMuted,
  success: merchantColors.success,
  warning: merchantColors.warning,
  danger: merchantColors.danger,
  border: merchantColors.border,
  radiusCard: merchantRadius.card,
  radiusButton: merchantRadius.button,
  radiusPill: merchantRadius.pill,
  shadowCard: merchantShadow.card
};

export const technicianPalette: RolePalette = {
  primary: techColors.primary,
  primaryLight: techColors.primaryLight,
  canvas: techColors.canvas,
  cardBg: techColors.cardBg,
  onPrimary: techColors.onPrimary,
  textPrimary: techColors.textPrimary,
  textSecondary: techColors.textSecondary,
  textMuted: techColors.textMuted,
  success: techColors.success,
  warning: techColors.warning,
  danger: techColors.danger,
  border: techColors.border,
  radiusCard: techRadius.card,
  radiusButton: techRadius.button,
  radiusPill: techRadius.pill,
  shadowCard: techShadow.card
};

export function paletteForProfileType(
  type: string | null | undefined
): RolePalette {
  switch (type as ProfileType | undefined) {
    case "veterinarian":
      return vetPalette;
    case "buyer":
      return buyerPalette;
    case "merchant":
      return merchantPalette;
    case "technician":
      return technicianPalette;
    case "producer":
    default:
      return producerPalette;
  }
}
