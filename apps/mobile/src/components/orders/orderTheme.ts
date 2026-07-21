import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";
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
  primarySoft: uiNamedColors.c68B978,
  primaryLight: mobileColors.accentSoft,
  primaryDark: uiNamedColors.c1F7A32,
  cardBg: mobileColors.background,
  textPrimary: mobileColors.textPrimary,
  textSecondary: mobileColors.textSecondary,
  textMuted: uiNamedColors.c9CA3AF,
  warning: mobileColors.warning,
  danger: mobileColors.error,
  border: mobileColors.border,
  railIdle: uiNamedColors.cE5E7EB,
  nodeIdle: mobileColors.surfaceMuted,
  activityHandle: uiNamedColors.cE5E7EB,
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
    neutral: { background: uiNamedColors.cF3F4F6, foreground: uiNamedColors.c374151 }
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
  railIdle: uiNamedColors.cE8E0DA,
  nodeIdle: uiNamedColors.cF0EAE4,
  activityHandle: uiNamedColors.cE0D6CE,
  onPrimary: uiNamedColors.cFFFFFF,
  radius: merchantRadius,
  shadow: merchantShadow,
  badges: {
    pending: {
      background: merchantColors.primaryLight,
      foreground: merchantColors.primaryDark
    },
    active: { background: uiNamedColors.cE0F2FE, foreground: uiNamedColors.c0369A1 },
    success: { background: uiNamedColors.cDCFCE7, foreground: uiNamedColors.c166534 },
    danger: { background: uiNamedColors.cFCE7F3, foreground: merchantColors.danger },
    neutral: { background: uiNamedColors.cF3F4F6, foreground: uiNamedColors.c374151 }
  }
};

/** Variante réservée au badge « litige » jaune historique. */
export const merchantWarningOrderPalette: OrderPalette = {
  ...merchantOrderPalette,
  badges: {
    ...merchantOrderPalette.badges,
    danger: { background: uiNamedColors.cFEF3C7, foreground: uiNamedColors.c92400E }
  }
};
