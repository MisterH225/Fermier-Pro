import {
  VET_NAV_BAR_HEIGHT,
  VET_NAV_FLOAT_BOTTOM,
  vetBottomChromeHeight
} from "../navigation/vet/vetNavMetrics";

/** Routes racine vétérinaire où le FAB d’actions rapides est visible. */
export const VET_QUICK_ACTION_ROOT_ROUTES = [
  "VeterinarianDashboard",
  "VetAgenda",
  "VetFarms"
] as const;

export type VetQuickActionRootRoute =
  (typeof VET_QUICK_ACTION_ROOT_ROUTES)[number];

export type VetQuickActionId = "farms" | "schedule" | "case";

export const VET_QUICK_ACTION_IDS: VetQuickActionId[] = [
  "farms",
  "schedule",
  "case"
];

/** Diamètre du bouton flottant (aligné producteur). */
export const VET_QUICK_FAB_SIZE = 56;

/** Marge entre le haut de la tab bar et le bas du FAB. */
export const VET_QUICK_FAB_GAP = 8;

export function vetQuickFabBottomOffset(insetBottom: number): number {
  return vetBottomChromeHeight(insetBottom) + VET_QUICK_FAB_GAP;
}

/** Espace liste pour ne pas masquer la dernière ligne sous le FAB. */
export function vetQuickFabListClearance(): number {
  return VET_QUICK_FAB_SIZE + VET_QUICK_FAB_GAP;
}

export function isVetQuickActionRootRoute(
  routeName: string | undefined | null
): routeName is VetQuickActionRootRoute {
  return (
    typeof routeName === "string" &&
    (VET_QUICK_ACTION_ROOT_ROUTES as readonly string[]).includes(routeName)
  );
}

export function vetQuickFabMetrics() {
  return {
    navBarHeight: VET_NAV_BAR_HEIGHT,
    navFloatBottom: VET_NAV_FLOAT_BOTTOM,
    fabSize: VET_QUICK_FAB_SIZE,
    fabGap: VET_QUICK_FAB_GAP
  };
}
