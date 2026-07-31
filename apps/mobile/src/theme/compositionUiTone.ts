import { mobileColors } from "./mobileTheme";
import { vetColors } from "./vetTheme";

export type CompositionUiTone = "producer" | "vet";

/** Palette partagée écrans / cartes composition (producteur vert vs véto bleu). */
export function compositionUiColors(tone: CompositionUiTone) {
  if (tone === "vet") {
    return {
      accent: vetColors.primary,
      accentSoft: vetColors.primaryLight,
      onAccent: vetColors.onPrimary,
      canvas: vetColors.canvas,
      background: vetColors.cardBg,
      textPrimary: vetColors.textPrimary,
      textSecondary: vetColors.textSecondary,
      border: "#C5D4EB",
      surfaceMuted: vetColors.primaryMuted
    } as const;
  }
  return {
    accent: mobileColors.accent,
    accentSoft: mobileColors.accentSoft,
    onAccent: mobileColors.onAccent,
    canvas: mobileColors.canvas,
    background: mobileColors.background,
    textPrimary: mobileColors.textPrimary,
    textSecondary: mobileColors.textSecondary,
    border: mobileColors.border,
    surfaceMuted: mobileColors.surfaceMuted
  } as const;
}

export function compositionDiscussLabel(tone: CompositionUiTone): string {
  return tone === "vet"
    ? "Continuer la discussion avec le fermier"
    : "Continuer la discussion avec mon vétérinaire";
}
