import type { MerchantMainTab } from "./types";

const ROUTES: Record<MerchantMainTab, string> = {
  home: "MerchantDashboard",
  shops: "MerchantShops",
  products: "MerchantProducts",
  marketplace: "MerchantMarket",
  orders: "MerchantOrders"
};

export function merchantMainTabFromRoute(
  routeName: string | undefined,
  params?: Record<string, unknown>
): MerchantMainTab | null {
  if (!routeName) return null;

  if (
    routeName === "MarketplaceList" &&
    params?.merchantView === true
  ) {
    return "marketplace";
  }
  if (routeName === "MerchantProductDetail") {
    return "marketplace";
  }
  if (routeName === "MerchantShopDetail") {
    return "shops";
  }

  const hit = (Object.entries(ROUTES) as [MerchantMainTab, string][]).find(
    ([, r]) => r === routeName
  );
  return hit?.[0] ?? null;
}
