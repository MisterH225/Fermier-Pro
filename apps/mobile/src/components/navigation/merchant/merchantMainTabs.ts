import type { MerchantMainTab } from "./types";

const ROUTES: Record<MerchantMainTab, string> = {
  home: "MerchantDashboard",
  products: "MerchantProducts",
  marketplace: "MerchantMarketplace",
  orders: "MerchantOrders"
};

export function merchantMainTabFromRoute(
  routeName: string | undefined
): MerchantMainTab | null {
  if (!routeName) return null;
  const hit = (Object.entries(ROUTES) as [MerchantMainTab, string][]).find(
    ([, r]) => r === routeName
  );
  return hit?.[0] ?? null;
}
