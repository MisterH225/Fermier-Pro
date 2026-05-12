export const mobileColors = {
  background: "#FFFFFF",
  surface: "#FAFAFA",
  surfaceMuted: "#F7F7F7",
  textPrimary: "#111111",
  textSecondary: "#6B6B6B",
  accent: "#2F9E44",
  accentSoft: "#EAF7EE",
  border: "#E8E8E8",
  success: "#1F8A3B",
  error: "#D64545",
  warning: "#E3A008"
} as const;

export const mobileSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
} as const;

export const mobileRadius = {
  sm: 10,
  md: 14,
  lg: 16,
  pill: 999
} as const;

export const mobileTypography = {
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "400" as const
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const
  }
} as const;

export const mobileShadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1
  }
} as const;
