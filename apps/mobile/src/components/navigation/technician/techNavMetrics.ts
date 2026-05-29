export const TECH_NAV_FLOAT_BOTTOM = 24;
export const TECH_NAV_BAR_HEIGHT = 64;

export function techBottomChromeHeight(insetBottom: number): number {
  return TECH_NAV_FLOAT_BOTTOM + TECH_NAV_BAR_HEIGHT + insetBottom;
}
