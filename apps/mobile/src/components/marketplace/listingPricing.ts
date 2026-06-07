import type { ListingCategory } from "../../lib/marketplaceListingForm";
import { usesFlatListingPrice } from "../../lib/marketplaceListingForm";

export function isFlatPriceListing(
  category: string | null | undefined
): boolean {
  if (!category) {
    return false;
  }
  return usesFlatListingPrice(category as ListingCategory);
}
