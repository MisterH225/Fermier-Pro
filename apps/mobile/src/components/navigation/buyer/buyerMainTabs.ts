import type { BuyerMainTab } from "./types";

const ROUTES: Record<BuyerMainTab, string> = {
  home: "BuyerDashboard",
  market: "BuyerMarket",
  messages: "BuyerMessages",
  orders: "BuyerHistory"
};

export function buyerMainTabFromRoute(
  routeName: string | undefined,
  params?: Record<string, unknown>
): BuyerMainTab | null {
  if (!routeName) return null;
  if (routeName === "MarketplaceList" && params?.buyerView === true) {
    return "market";
  }
  const hit = (Object.entries(ROUTES) as [BuyerMainTab, string][]).find(
    ([, r]) => r === routeName
  );
  return hit?.[0] ?? null;
}
