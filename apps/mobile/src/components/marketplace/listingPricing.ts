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

function parseListingNum(
  v: string | number | null | undefined
): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function listingDisplayHeadcount(item: {
  animalIds?: string[] | null;
  animal?: { id: string } | null;
  quantity?: number | null;
}): number {
  if (item.animalIds && item.animalIds.length > 0) {
    return item.animalIds.length;
  }
  if (item.animal) {
    return 1;
  }
  if (item.quantity != null && item.quantity > 0) {
    return item.quantity;
  }
  return 1;
}

/** Prix forfaitaire à la tête (porcelet / reproducteur). */
export function flatListingUnitPrice(item: {
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  animalIds?: string[] | null;
  animal?: { id: string } | null;
  quantity?: number | null;
}): number | null {
  const unit = parseListingNum(item.unitPrice);
  if (unit != null && unit > 0) {
    return unit;
  }
  const total = parseListingNum(item.totalPrice);
  const headcount = listingDisplayHeadcount(item);
  if (total != null && total > 0 && headcount > 0) {
    return total / headcount;
  }
  return null;
}
