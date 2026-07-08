import type { MerchantMeDto } from "./api/merchant";

export function hasMerchantShop(me: MerchantMeDto | null | undefined): boolean {
  return (me?.shops?.length ?? 0) > 0;
}

export function resolveMerchantShopId(
  me: MerchantMeDto | null | undefined,
  preferredShopId?: string | null
): string | null {
  if (!me?.shops?.length) return null;
  if (preferredShopId && me.shops.some((s) => s.id === preferredShopId)) {
    return preferredShopId;
  }
  return me.shops[0]?.id ?? null;
}
