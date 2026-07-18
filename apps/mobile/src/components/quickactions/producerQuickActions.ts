import {
  PRODUCER_NAV_BAR_HEIGHT,
  PRODUCER_NAV_FLOAT_BOTTOM,
  producerBottomChromeHeight
} from "../navigation/producerNavMetrics";

/** Routes racine producteur où le FAB d’actions rapides est visible. */
export const PRODUCER_QUICK_ACTION_ROOT_ROUTES = [
  "ProducerDashboard",
  "FarmLivestock",
  "FarmHealth",
  "MarketplaceList",
  "FarmFinance"
] as const;

export type ProducerQuickActionRootRoute =
  (typeof PRODUCER_QUICK_ACTION_ROOT_ROUTES)[number];

export type ProducerQuickActionId =
  | "weigh"
  | "mortality"
  | "farrowing"
  | "sell"
  | "expense";

export const PRODUCER_QUICK_ACTION_IDS: ProducerQuickActionId[] = [
  "weigh",
  "mortality",
  "farrowing",
  "sell",
  "expense"
];

/** Diamètre du bouton flottant (cible tactile). */
export const PRODUCER_QUICK_FAB_SIZE = 56;

/** Marge entre le haut de la tab bar et le bas du FAB. */
export const PRODUCER_QUICK_FAB_GAP = 8;

/**
 * Offset `bottom` du FAB : chrome tab bar mesuré (float + hauteur barre + safe area)
 * + petit gap. Aucune hauteur d’appareil en dur.
 */
export function producerQuickFabBottomOffset(insetBottom: number): number {
  return producerBottomChromeHeight(insetBottom) + PRODUCER_QUICK_FAB_GAP;
}

/** Espace supplémentaire à réserver en bas des listes pour ne pas masquer la dernière ligne. */
export function producerQuickFabListClearance(): number {
  return PRODUCER_QUICK_FAB_SIZE + PRODUCER_QUICK_FAB_GAP;
}

export function isProducerQuickActionRootRoute(
  routeName: string | undefined | null
): routeName is ProducerQuickActionRootRoute {
  return (
    typeof routeName === "string" &&
    (PRODUCER_QUICK_ACTION_ROOT_ROUTES as readonly string[]).includes(routeName)
  );
}

/** Exposé pour les tests : la hauteur de barre utilisée dans le calcul d’offset. */
export function producerQuickFabMetrics() {
  return {
    navBarHeight: PRODUCER_NAV_BAR_HEIGHT,
    navFloatBottom: PRODUCER_NAV_FLOAT_BOTTOM,
    fabSize: PRODUCER_QUICK_FAB_SIZE,
    fabGap: PRODUCER_QUICK_FAB_GAP
  };
}
