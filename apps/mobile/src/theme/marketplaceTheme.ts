import { mobileColors } from "./mobileTheme";

/** Charte olive marketplace (annonces, détail listing, cartes). */
export const marketplaceColors = {
  primary: "#5D7A1F",
  primaryDark: "#1F2910",
  muted: "#6D745B",
  border: "#E0E4D4",
  handover: "#C4A574",
  closedText: "#6B5420",
  closedBg: "#F0E8D8",
  offers: "#B45309",
  pending: "#D97706",
  reservedText: "#2D5A6E",
  reservedBg: "#E8F4F8",
  note: "#8B4513",
  placeholder: "#999999",
  textMuted: mobileColors.textTertiary,
  onPrimary: mobileColors.onAccent,
  /** Tokens déjà en dur (non-régression). */
  warnAmber: "#BA7517",
  warnAmberBg: "#FFF4E0",
  warnAmberBorder: "#F0D9A8",
  successTeal: "#1D9E75",
  successSoftBg: "#E8F8F0",
  surfaceGray: "#F5F5F5",
  meteoGrayBg: "#F3F4F6",
  meteoGrayBorder: "#D1D5DB",
  meteoGrayText: "#6B7280"
} as const;
