export const VET_NAV_FLOAT_BOTTOM = 24;
export const VET_NAV_BAR_HEIGHT = 64;

export function vetBottomChromeHeight(insetBottom: number): number {
  return VET_NAV_FLOAT_BOTTOM + VET_NAV_BAR_HEIGHT + insetBottom;
}
