import type { MarketplaceListing, MarketplaceOffer } from "@prisma/client";
import {
  MarketplacePriceType,
  MarketplaceTransactionStatus
} from "@prisma/client";
import { usesFlatListingPrice } from "../marketplace-listing-category.helper";

const PAYMENT_BUFFER = 1.1;
const PAYMENT_EXPIRY_MS = 48 * 60 * 60 * 1000;

export function lastNMonthKeys(count = 6): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

export function resolvePriceType(
  listing: Pick<MarketplaceListing, "category">
): MarketplacePriceType {
  return usesFlatListingPrice(listing.category)
    ? MarketplacePriceType.flat
    : MarketplacePriceType.per_kg;
}

/** Montant convenu entre acheteur et vendeur (hors marge escrow 10 % au kg). */
export function calculateAgreedDealAmount(params: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
  offeredPrice?: number | null;
}): number {
  if (params.priceType === MarketplacePriceType.flat) {
    if (params.agreedFlatPrice != null && params.agreedFlatPrice > 0) {
      return params.agreedFlatPrice;
    }
  } else if (
    params.agreedPricePerKg != null &&
    params.estimatedWeightKg != null &&
    params.agreedPricePerKg > 0 &&
    params.estimatedWeightKg > 0
  ) {
    return params.agreedPricePerKg * params.estimatedWeightKg;
  }
  if (params.offeredPrice != null && params.offeredPrice > 0) {
    return params.offeredPrice;
  }
  return 0;
}

export function calculateBlockedAmount(params: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
}): number {
  if (params.priceType === MarketplacePriceType.flat) {
    if (params.agreedFlatPrice == null || params.agreedFlatPrice <= 0) {
      throw new Error("Prix forfaitaire invalide");
    }
    return params.agreedFlatPrice;
  }
  if (
    params.agreedPricePerKg == null ||
    params.estimatedWeightKg == null ||
    params.agreedPricePerKg <= 0 ||
    params.estimatedWeightKg <= 0
  ) {
    throw new Error("Prix/kg ou poids estimé invalide");
  }
  return params.agreedPricePerKg * params.estimatedWeightKg * PAYMENT_BUFFER;
}

export function agreedTermsFromOffer(
  offer: MarketplaceOffer,
  listing: MarketplaceListing
): {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
} {
  const priceType = resolvePriceType(listing);
  const offered = Number(offer.offeredPrice);
  if (priceType === MarketplacePriceType.flat) {
    return {
      priceType,
      agreedPricePerKg: null,
      agreedFlatPrice: offered,
      estimatedWeightKg: listing.totalWeightKg
        ? Number(listing.totalWeightKg)
        : null
    };
  }
  const weight = listing.totalWeightKg ? Number(listing.totalWeightKg) : null;
  const perKg =
    offer.proposedPricePerKg != null
      ? Number(offer.proposedPricePerKg)
      : weight && weight > 0
        ? offered / weight
        : null;
  return {
    priceType,
    agreedPricePerKg: perKg,
    agreedFlatPrice: null,
    estimatedWeightKg: weight
  };
}

export function paymentExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_EXPIRY_MS);
}

export function calculateFinalAmount(tx: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: { toNumber(): number } | null;
  agreedFlatPrice: { toNumber(): number } | null;
  realWeightKg: { toNumber(): number } | null;
  arbitrationWeightKg: { toNumber(): number } | null;
}): number {
  if (tx.priceType === MarketplacePriceType.flat) {
    return tx.agreedFlatPrice ? tx.agreedFlatPrice.toNumber() : 0;
  }
  const perKg = tx.agreedPricePerKg?.toNumber() ?? 0;
  const weight =
    tx.arbitrationWeightKg?.toNumber() ??
    tx.realWeightKg?.toNumber() ??
    0;
  return perKg * weight;
}

export function settlementAmounts(params: {
  blockedAmount: number;
  finalAmount: number;
  commissionRate: number;
}): {
  commissionAmount: number;
  sellerReceivedAmount: number;
  buyerRefundAmount: number;
  buyerAdditionalCharge: number;
} {
  const commissionAmount = params.finalAmount * params.commissionRate;
  const sellerReceivedAmount = params.finalAmount - commissionAmount;
  const delta = params.blockedAmount - params.finalAmount;
  const buyerRefundAmount = delta > 0 ? delta : 0;
  const buyerAdditionalCharge = delta < 0 ? Math.abs(delta) : 0;
  return {
    commissionAmount,
    sellerReceivedAmount,
    buyerRefundAmount,
    buyerAdditionalCharge
  };
}

export const ACTIVE_ESCROW_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED,
  MarketplaceTransactionStatus.BUYER_RECEIVED,
  MarketplaceTransactionStatus.DELIVERY_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED
];

export const SHIPMENT_CONFIRM_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED
];

/** Statuts bloquant la modification d'une annonce (escrow + paiement en attente). */
export const LISTING_EDIT_LOCK_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  ...ACTIVE_ESCROW_STATUSES
];

export const CANCELLABLE_BY_BUYER: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED
];

export const CANCELLABLE_BY_SELLER: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED
];
