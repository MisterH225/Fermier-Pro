import type { BuyerMainTab } from "./types";

const ROUTES: Record<BuyerMainTab, string> = {
  home: "BuyerDashboard",
  market: "BuyerMarket",
  messages: "BuyerMessages",
  orders: "BuyerHistory"
};

/** Deep links Marché (segments Favoris / Alertes). */
const MARKET_DEEP_LINKS = new Set(["BuyerFavorites", "BuyerAlerts"]);

export function buyerMainTabFromRoute(
  routeName: string | undefined,
  _params?: Record<string, unknown>
): BuyerMainTab | null {
  if (!routeName) return null;
  if (MARKET_DEEP_LINKS.has(routeName)) {
    return "market";
  }
  const hit = (Object.entries(ROUTES) as [BuyerMainTab, string][]).find(
    ([, r]) => r === routeName
  );
  return hit?.[0] ?? null;
}
