export const BUYER_NAV_FLOAT_BOTTOM = 24;
export const BUYER_NAV_BAR_HEIGHT = 64;

export function buyerBottomChromeHeight(insetBottom: number): number {
  return BUYER_NAV_FLOAT_BOTTOM + BUYER_NAV_BAR_HEIGHT + insetBottom;
}
