/** Thème bleu médical — module vétérinaire uniquement. */
export const vetColors = {
  primary: "#2B7FFF",
  primaryLight: "#EEF4FF",
  primaryDark: "#1A5FCC",
  secondary: "#F0F4FF",
  accent: "#4ECDC4",
  textPrimary: "#1A1D23",
  textSecondary: "#6B7280",
  background: "#F8FAFF",
  cardBg: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  border: "rgba(43, 127, 255, 0.12)"
} as const;

export const vetRadius = {
  card: 16,
  button: 12,
  pill: 999
} as const;

export const vetShadow = {
  card: {
    shadowColor: "#2B7FFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3
  }
} as const;
