/** Distance du bas de l’écran au bas de la pill (au-dessus de la safe area). */
export const PRODUCER_NAV_FLOAT_BOTTOM = 24;

/** Hauteur unique pill + bouton « + » (homogène). */
export const PRODUCER_NAV_BAR_HEIGHT = 50;

/** @deprecated alias — utiliser `PRODUCER_NAV_BAR_HEIGHT`. */
export const PRODUCER_NAV_ROW_HEIGHT = PRODUCER_NAV_BAR_HEIGHT;

export function producerBottomChromeHeight(insetBottom: number): number {
  return PRODUCER_NAV_FLOAT_BOTTOM + PRODUCER_NAV_BAR_HEIGHT + insetBottom;
}
