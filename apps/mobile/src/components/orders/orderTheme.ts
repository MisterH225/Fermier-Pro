import type { ProfileType } from "@fermier/types";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { techColors, techRadius, techShadow } from "../../theme/technicianTheme";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
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
  canvas: string;
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

const semanticBadges = {
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
  neutral: {
    background: uiNamedColors.cF3F4F6,
    foreground: uiNamedColors.c374151
  }
} as const;

/** Palette neutre / producteur pour le hub transversal « Mes commandes ». */
export const ordersPalette: OrderPalette = {
  primary: mobileColors.accent,
  primarySoft: uiNamedColors.c68B978,
  primaryLight: mobileColors.accentSoft,
  primaryDark: uiNamedColors.c1F7A32,
  cardBg: mobileColors.background,
  canvas: mobileColors.background,
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
    ...semanticBadges
  }
};

export const buyerOrderPalette: OrderPalette = {
  primary: buyerColors.primary,
  primarySoft: buyerColors.primarySoft,
  primaryLight: buyerColors.primaryLight,
  primaryDark: buyerColors.primaryDark,
  cardBg: buyerColors.cardBg,
  canvas: buyerColors.canvas,
  textPrimary: buyerColors.textPrimary,
  textSecondary: buyerColors.textSecondary,
  textMuted: buyerColors.textMuted,
  warning: buyerColors.warning,
  danger: buyerColors.danger,
  border: buyerColors.border,
  railIdle: "rgba(124, 58, 237, 0.18)",
  nodeIdle: buyerColors.primaryLight,
  activityHandle: "rgba(124, 58, 237, 0.22)",
  onPrimary: buyerColors.onPrimary,
  radius: buyerRadius,
  shadow: buyerShadow,
  badges: {
    pending: {
      background: buyerColors.primaryLight,
      foreground: buyerColors.primaryDark
    },
    ...semanticBadges,
    danger: {
      background: buyerColors.kpiRose,
      foreground: buyerColors.danger
    }
  }
};

/** Palette iso-pixel des écrans boutique historiques. */
export const merchantOrderPalette: OrderPalette = {
  primary: merchantColors.primary,
  primarySoft: merchantColors.primarySoft,
  primaryLight: merchantColors.primaryLight,
  primaryDark: merchantColors.primaryDark,
  cardBg: merchantColors.cardBg,
  canvas: merchantColors.canvas,
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

export const vetOrderPalette: OrderPalette = {
  primary: vetColors.primary,
  primarySoft: vetColors.primarySoft,
  primaryLight: vetColors.primaryLight,
  primaryDark: vetColors.primaryDark,
  cardBg: vetColors.cardBg,
  canvas: vetColors.canvas,
  textPrimary: vetColors.textPrimary,
  textSecondary: vetColors.textSecondary,
  textMuted: vetColors.textMuted,
  warning: vetColors.warning,
  danger: vetColors.danger,
  border: vetColors.border,
  railIdle: "rgba(43, 127, 255, 0.18)",
  nodeIdle: vetColors.primaryLight,
  activityHandle: "rgba(43, 127, 255, 0.22)",
  onPrimary: vetColors.onPrimary,
  radius: {
    card: vetRadius.card,
    button: vetRadius.button,
    pill: vetRadius.pill
  },
  shadow: vetShadow,
  badges: {
    pending: {
      background: vetColors.primaryLight,
      foreground: vetColors.primaryDark
    },
    ...semanticBadges,
    danger: {
      background: vetColors.kpiRose,
      foreground: vetColors.danger
    }
  }
};

export const technicianOrderPalette: OrderPalette = {
  primary: techColors.primary,
  primarySoft: techColors.primarySoft,
  primaryLight: techColors.primaryLight,
  primaryDark: techColors.primaryDark,
  cardBg: techColors.cardBg,
  canvas: techColors.canvas,
  textPrimary: techColors.textPrimary,
  textSecondary: techColors.textSecondary,
  textMuted: techColors.textMuted,
  warning: techColors.warning,
  danger: techColors.danger,
  border: techColors.border,
  railIdle: "rgba(255, 107, 53, 0.2)",
  nodeIdle: techColors.primaryLight,
  activityHandle: "rgba(255, 107, 53, 0.25)",
  onPrimary: techColors.onPrimary,
  radius: techRadius,
  shadow: techShadow,
  badges: {
    pending: {
      background: techColors.primaryLight,
      foreground: techColors.primary
    },
    ...semanticBadges
  }
};

/** Variante badge « problème » ambre (sémantique, indépendante de la marque). */
export function warningOrderPalette(base: OrderPalette): OrderPalette {
  return {
    ...base,
    badges: {
      ...base.badges,
      danger: {
        background: uiNamedColors.cFEF3C7,
        foreground: uiNamedColors.c92400E
      }
    }
  };
}

/** @deprecated préférer warningOrderPalette(base) */
export const merchantWarningOrderPalette: OrderPalette =
  warningOrderPalette(merchantOrderPalette);

/** Palette commande alignée sur le profil actif. */
export function orderPaletteForProfileType(
  type: string | null | undefined
): OrderPalette {
  switch (type as ProfileType | undefined) {
    case "buyer":
      return buyerOrderPalette;
    case "merchant":
      return merchantOrderPalette;
    case "veterinarian":
      return vetOrderPalette;
    case "technician":
      return technicianOrderPalette;
    case "producer":
    default:
      return ordersPalette;
  }
}
