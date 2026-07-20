import type { RootStackParamList } from "../types/navigation";

export type BuyerMarketLaunchParams = NonNullable<
  RootStackParamList["BuyerMarket"]
>;

let pending: BuyerMarketLaunchParams | null = null;

/** File un lancement Marché après sortie d'onboarding (hors NavigationContainer). */
export function queueBuyerMarketLaunch(params: BuyerMarketLaunchParams) {
  pending = params;
}

export function consumeBuyerMarketLaunch(): BuyerMarketLaunchParams | null {
  const next = pending;
  pending = null;
  return next;
}
