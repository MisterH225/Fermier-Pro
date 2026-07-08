import type { MerchantMeDto } from "./api/merchant";

export function hasMerchantShop(me: MerchantMeDto | null | undefined): boolean {
  return (me?.shops?.length ?? 0) > 0 || (me?.shopCount ?? 0) > 0;
}

/**
 * Résout la boutique cible pour créer/éditer un produit.
 * Le shopId de navigation est prioritaire : l'écran boutiques peut l'avoir
 * alors que le cache React Query `merchant-me` n'est pas encore rafraîchi.
 */
export function resolveMerchantShopId(
  me: MerchantMeDto | null | undefined,
  preferredShopId?: string | null
): string | null {
  if (preferredShopId) {
    return preferredShopId;
  }
  if (!me?.shops?.length) {
    return null;
  }
  return me.shops[0]?.id ?? null;
}
