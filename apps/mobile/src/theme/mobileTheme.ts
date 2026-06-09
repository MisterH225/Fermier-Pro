export const mobileColors = {
  /** Fond global des écrans (liste / formulaires), sous les cartes blanches. */
  canvas: "#F2F2F7",
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
  warning: "#E3A008",
  /** Texte sur fond accent ou header sombre. */
  onAccent: "#FFFFFF",
  /** Texte tertiaire (adresses, labels discrets). */
  textTertiary: "#4B513D",
  shadow: "#000000"
} as const;

/** Surfaces et textes pour badges / alertes d'état. */
export const mobileStatusSurfaces = {
  successBg: "#DCFCE7",
  successText: "#166534",
  warningBg: "#FFF3E0",
  warningText: "#F57F17",
  infoBg: "#E3F2FD",
  infoText: "#1565C0",
  positiveBg: "#E8F5E9",
  positiveText: "#2E7D32"
} as const;

/** Paires bg/accent pour cartes KPI (gestation, dashboards). */
export const mobileKpiPalette = {
  gestation: { bg: mobileStatusSurfaces.warningBg, accent: "#FF8C00" },
  dueSoon: { bg: mobileStatusSurfaces.infoBg, accent: mobileStatusSurfaces.infoText },
  dueMonth: { bg: "#FFF8E1", accent: mobileStatusSurfaces.warningText },
  available: { bg: mobileStatusSurfaces.positiveBg, accent: mobileStatusSurfaces.positiveText }
} as const;

/** CTA primaire plein (boutons accent). */
export const mobilePrimaryCta = {
  button: {
    backgroundColor: mobileColors.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  label: {
    color: mobileColors.onAccent,
    fontWeight: "700" as const
  },
  spinner: mobileColors.onAccent
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
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700" as const
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
    shadowColor: mobileColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1
  }
} as const;

/** Boutons texte en haut à droite des écrans (header). */
export const mobileHeaderButton = {
  btn: { marginRight: mobileSpacing.sm, paddingVertical: 4, paddingHorizontal: 2 },
  text: {
    color: mobileColors.accent,
    fontWeight: "600" as const,
    fontSize: 15
  }
} as const;

/** Bouton header sur fond accent / header sombre. */
export const mobileHeaderButtonOnDark = {
  btn: { paddingHorizontal: 8 },
  text: {
    color: mobileColors.onAccent,
    fontWeight: "600" as const,
    fontSize: 15
  }
} as const;
