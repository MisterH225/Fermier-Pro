import { ListingMarketCategory } from "@prisma/client";

export const PIG_LISTING_CATEGORIES = [
  ListingMarketCategory.piglet,
  ListingMarketCategory.breeder,
  ListingMarketCategory.butcher,
  ListingMarketCategory.reformed
] as const;

export type MarketplaceFeedKind = "listing" | "merchant";

export function isPigListingCategory(
  category?: string | null
): category is ListingMarketCategory {
  return (
    category != null &&
    (PIG_LISTING_CATEGORIES as readonly string[]).includes(category)
  );
}

export function shouldIncludePigListings(category?: string | null): boolean {
  return !category || category === "all" || isPigListingCategory(category);
}

export function shouldIncludeMerchantProducts(category?: string | null): boolean {
  return !category || category === "all" || !isPigListingCategory(category);
}

type MerchantProductFeedRow = {
  id: string;
  name: string;
  description: string | null;
  price: { toString(): string } | number;
  currency: string;
  photoUrls: unknown;
  stock: number;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string };
  shop: {
    id: string;
    name: string;
    locationLabel: string | null;
    merchantProfile: { user: { id: string; fullName: string | null } };
  };
};

export function merchantProductToFeedItem(product: MerchantProductFeedRow) {
  const photoUrls = Array.isArray(product.photoUrls)
    ? product.photoUrls.filter((u): u is string => typeof u === "string")
    : [];
  const price =
    typeof product.price === "number"
      ? product.price
      : Number(product.price.toString());
  const publishedAt = product.publishedAt?.toISOString() ?? null;

  return {
    id: product.id,
    kind: "merchant" as const,
    sellerUserId: product.shop.merchantProfile.user.id,
    title: product.name,
    description: product.description,
    unitPrice: price,
    quantity: product.stock,
    stock: product.stock,
    currency: product.currency,
    locationLabel: product.shop.locationLabel,
    status: "published",
    publishedAt,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    category: product.category.slug,
    categoryLabel: product.category.name,
    photoUrls,
    fallbackPhotoUrl: null,
    animalIds: [] as string[],
    totalWeightKg: null,
    weightBasis: null,
    pricePerKg: null,
    totalPrice: price,
    breedLabel: null,
    viewsCount: product.viewCount,
    consultationsCount: 0,
    expiresAt: null,
    activeOfferCount: 0,
    creditEnabled: false,
    farm: { id: product.shop.id, name: product.shop.name },
    animal: null,
    seller: {
      id: product.shop.merchantProfile.user.id,
      fullName: product.shop.merchantProfile.user.fullName
    }
  };
}

export function withListingKind<T extends Record<string, unknown>>(row: T) {
  return { ...row, kind: "listing" as const };
}

export function sortFeedByPublishedAt<
  T extends { publishedAt?: string | Date | null; createdAt?: string | Date }
>(rows: T[]): T[] {
  const ts = (row: T) => {
    const raw = row.publishedAt ?? row.createdAt;
    if (!raw) return 0;
    return new Date(raw).getTime();
  };
  return [...rows].sort((a, b) => ts(b) - ts(a));
}
