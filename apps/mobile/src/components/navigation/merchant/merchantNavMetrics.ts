export const MERCHANT_NAV_FLOAT_BOTTOM = 24;
export const MERCHANT_NAV_BAR_HEIGHT = 64;

export function merchantBottomChromeHeight(insetBottom: number): number {
  return MERCHANT_NAV_FLOAT_BOTTOM + MERCHANT_NAV_BAR_HEIGHT + insetBottom;
}
