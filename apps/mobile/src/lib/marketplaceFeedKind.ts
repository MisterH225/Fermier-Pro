/** Kind feed marketplace qui utilisent le détail / commande produit commerçant. */
export function isMerchantMarketplaceKind(
  kind?: string | null
): kind is "merchant" | "bulk_feed" {
  return kind === "merchant" || kind === "bulk_feed";
}
