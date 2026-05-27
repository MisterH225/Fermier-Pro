import type { BuyerMainTab } from "./types";

const ROUTES: Record<BuyerMainTab, string> = {
  home: "BuyerDashboard",
  market: "BuyerMarket",
  messages: "BuyerMessages",
  history: "BuyerHistory"
};

export function buyerMainTabFromRoute(routeName: string | undefined): BuyerMainTab | null {
  if (!routeName) return null;
  const hit = (Object.entries(ROUTES) as [BuyerMainTab, string][]).find(([, r]) => r === routeName);
  return hit?.[0] ?? null;
}
