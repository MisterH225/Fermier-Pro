import { PigPriceIndexCategory, ListingMarketCategory } from "@prisma/client";

export type PigPriceIndexPeriod = "7d" | "30d" | "3m" | "12m";

export const PIG_PRICE_INDEX_PERIODS: PigPriceIndexPeriod[] = [
  "7d",
  "30d",
  "3m",
  "12m"
];

export const MIN_TRANSACTIONS_FOR_POINT = 3;
export const MIN_POINTS_FOR_INDEX = 3;

export const PIG_PRICE_CATEGORY_COLORS: Record<
  Exclude<PigPriceIndexCategory, "global">,
  string
> = {
  porcelet: "#FF6B35",
  croissance: "#00C9A7",
  charcutier: "#7C3AED",
  reproducteur: "#FFB800"
};

export const LISTING_CURVE_COLOR = "#FF4757";

export type SaleBucket = {
  sumPrice: number;
  sumWeight: number;
  count: number;
  minPricePerKg: number | null;
  maxPricePerKg: number | null;
};

export type ListingBucket = {
  sumPricePerKg: number;
  count: number;
};

export function emptySaleBucket(): SaleBucket {
  return {
    sumPrice: 0,
    sumWeight: 0,
    count: 0,
    minPricePerKg: null,
    maxPricePerKg: null
  };
}

export function emptyListingBucket(): ListingBucket {
  return { sumPricePerKg: 0, count: 0 };
}

/** Catégorie indice depuis une vente animale (poids + production). */
export function categoryFromSale(
  productionCategory: string,
  weightKg: number
): PigPriceIndexCategory | null {
  if (
    productionCategory === "breeding_female" ||
    productionCategory === "breeding_male"
  ) {
    return PigPriceIndexCategory.reproducteur;
  }
  if (weightKg < 15) {
    return PigPriceIndexCategory.porcelet;
  }
  if (weightKg <= 50) {
    return PigPriceIndexCategory.croissance;
  }
  if (weightKg <= 110) {
    return PigPriceIndexCategory.charcutier;
  }
  return null;
}

/** Catégorie indice depuis une annonce (délégué au helper marketplace). */
export { categoryForPriceIndexFromListing as categoryFromListing } from "../marketplace/marketplace-listing-category.helper";

export function weightedAvgFromBucket(bucket: SaleBucket): number | null {
  if (bucket.sumWeight <= 0 || bucket.count === 0) {
    return null;
  }
  return bucket.sumPrice / bucket.sumWeight;
}

export function avgFromListingBucket(bucket: ListingBucket): number | null {
  if (bucket.count <= 0) {
    return null;
  }
  return bucket.sumPricePerKg / bucket.count;
}

export function addSaleToBucket(
  bucket: SaleBucket,
  price: number,
  weightKg: number
): void {
  const pricePerKg = price / weightKg;
  bucket.sumPrice += price;
  bucket.sumWeight += weightKg;
  bucket.count += 1;
  bucket.minPricePerKg =
    bucket.minPricePerKg == null
      ? pricePerKg
      : Math.min(bucket.minPricePerKg, pricePerKg);
  bucket.maxPricePerKg =
    bucket.maxPricePerKg == null
      ? pricePerKg
      : Math.max(bucket.maxPricePerKg, pricePerKg);
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return startOfUtcDay(next);
}

export function periodToDays(period: PigPriceIndexPeriod): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "3m":
      return 90;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

export function parsePeriod(raw?: string): PigPriceIndexPeriod {
  if (raw && PIG_PRICE_INDEX_PERIODS.includes(raw as PigPriceIndexPeriod)) {
    return raw as PigPriceIndexPeriod;
  }
  return "30d";
}

export function parseCategory(
  raw?: string
): PigPriceIndexCategory | "all" {
  if (!raw || raw === "all") {
    return "all";
  }
  if (
    Object.values(PigPriceIndexCategory).includes(raw as PigPriceIndexCategory)
  ) {
    return raw as PigPriceIndexCategory;
  }
  return "all";
}

export function categoryLabelFr(category: PigPriceIndexCategory): string {
  switch (category) {
    case PigPriceIndexCategory.porcelet:
      return "Porcelets";
    case PigPriceIndexCategory.croissance:
      return "Croissance";
    case PigPriceIndexCategory.charcutier:
      return "Charcutier";
    case PigPriceIndexCategory.reproducteur:
      return "Reproducteurs";
    case PigPriceIndexCategory.global:
      return "Global";
    default:
      return category;
  }
}
