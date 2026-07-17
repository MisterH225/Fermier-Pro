import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

export type OrderPalette = {
  primary: string;
  primarySoft: string;
  primaryLight: string;
  primaryDark: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  warning: string;
  danger: string;
  border: string;
  railIdle: string;
  nodeIdle: string;
  activityHandle: string;
  onPrimary: string;
  radius: {
    card: number;
    button: number;
    pill: number;
  };
  shadow: {
    card: object;
    floating: object;
  };
  badges: {
    pending: { background: string; foreground: string };
    active: { background: string; foreground: string };
    success: { background: string; foreground: string };
    danger: { background: string; foreground: string };
    neutral: { background: string; foreground: string };
  };
};

/** Palette neutre par défaut pour le hub transversal « Mes commandes ». */
export const ordersPalette: OrderPalette = {
  primary: mobileColors.accent,
  primarySoft: "#68B978",
  primaryLight: mobileColors.accentSoft,
  primaryDark: "#1F7A32",
  cardBg: mobileColors.background,
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: "#9CA3AF",
  warning: mobileColors.warning,
  danger: mobileColors.error,
  border: mobileColors.border,
  railIdle: "#E5E7EB",
  nodeIdle: mobileColors.surfaceMuted,
  activityHandle: "#E5E7EB",
  onPrimary: mobileColors.onAccent,
  radius: {
    card: mobileRadius.lg,
    button: mobileRadius.md,
    pill: mobileRadius.pill
  },
  shadow: {
    card: mobileShadows.card,
    floating: mobileShadows.card
  },
  badges: {
    pending: {
      background: mobileStatusSurfaces.warningBg,
      foreground: mobileStatusSurfaces.warningText
    },
    active: {
      background: mobileStatusSurfaces.infoBg,
      foreground: mobileStatusSurfaces.infoText
    },
    success: {
      background: mobileStatusSurfaces.successBg,
      foreground: mobileStatusSurfaces.successText
    },
    danger: {
      background: mobileStatusSurfaces.errorBg,
      foreground: mobileColors.error
    },
    neutral: { background: "#F3F4F6", foreground: "#374151" }
  }
};

/** Palette iso-pixel des écrans boutique historiques. */
export const merchantOrderPalette: OrderPalette = {
  primary: merchantColors.primary,
  primarySoft: merchantColors.primarySoft,
  primaryLight: merchantColors.primaryLight,
  primaryDark: merchantColors.primaryDark,
  cardBg: merchantColors.cardBg,
  textPrimary: merchantColors.textPrimary,
  textSecondary: merchantColors.textSecondary,
  textMuted: merchantColors.textMuted,
  warning: merchantColors.warning,
  danger: merchantColors.danger,
  border: merchantColors.border,
  railIdle: "#E8E0DA",
  nodeIdle: "#F0EAE4",
  activityHandle: "#E0D6CE",
  onPrimary: "#FFFFFF",
  radius: merchantRadius,
  shadow: merchantShadow,
  badges: {
    pending: {
      background: merchantColors.primaryLight,
      foreground: merchantColors.primaryDark
    },
    active: { background: "#E0F2FE", foreground: "#0369A1" },
    success: { background: "#DCFCE7", foreground: "#166534" },
    danger: { background: "#FCE7F3", foreground: merchantColors.danger },
    neutral: { background: "#F3F4F6", foreground: "#374151" }
  }
};

/** Variante réservée au badge « litige » jaune historique. */
export const merchantWarningOrderPalette: OrderPalette = {
  ...merchantOrderPalette,
  badges: {
    ...merchantOrderPalette.badges,
    danger: { background: "#FEF3C7", foreground: "#92400E" }
  }
};
