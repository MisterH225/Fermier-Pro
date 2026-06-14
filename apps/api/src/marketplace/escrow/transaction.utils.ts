import type { MarketplaceListing, MarketplaceOffer } from "@prisma/client";
import {
  MarketplacePriceType,
  MarketplaceTransactionStatus
} from "@prisma/client";
import { usesFlatListingPrice } from "../marketplace-listing-category.helper";

// PAYMENT_BUFFER = 1.0 : pas de marge buffer — l'acheteur paye exactement deal + frais acheteur
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

/**
 * Calcule le montant à bloquer en escrow lors du paiement.
 *
 * Prix forfaitaire : montant convenu + frais acheteur (commission sur le prix convenu).
 * Prix/kg : montant convenu + frais acheteur + marge buffer +10 % pour le poids réel.
 *   La commission est calculée sur le PRIX CONVENU (pricePerKg × estimatedWeight),
 *   pas sur le montant bufféré — conformément à la règle : "les frais sont prélevés
 *   sur le montant affiché/convenu avec le vendeur".
 */
export function calculateBlockedAmount(params: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
  commissionRate?: number;
}): number {
  const commissionRate = params.commissionRate ?? 0;
  if (params.priceType === MarketplacePriceType.flat) {
    if (params.agreedFlatPrice == null || params.agreedFlatPrice <= 0) {
      throw new Error("Prix forfaitaire invalide");
    }
    // Flat : blockedAmount = prix convenu + frais acheteur
    return Math.round(params.agreedFlatPrice * (1 + commissionRate));
  }
  if (
    params.agreedPricePerKg == null ||
    params.estimatedWeightKg == null ||
    params.agreedPricePerKg <= 0 ||
    params.estimatedWeightKg <= 0
  ) {
    throw new Error("Prix/kg ou poids estimé invalide");
  }
  // Per_kg : blockedAmount = prix convenu × (1 + commissionRate)
  // Pas de marge buffer — même logique que le prix forfaitaire.
  const agreedDeal = params.agreedPricePerKg * params.estimatedWeightKg;
  return Math.round(agreedDeal * (1 + commissionRate));
  // Note : si le poids réel > poids estimé, un complément (buyerAdditionalCharge) est calculé à la clôture.
}

/**
 * Estime les frais de plateforme affichés à l'acheteur avant le paiement.
 * Pour flat : frais exacts. Pour per_kg : estimation basée sur le poids estimé.
 */
export function estimatePlatformFee(params: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
  commissionRate: number;
}): number {
  if (params.commissionRate <= 0) return 0;
  if (params.priceType === MarketplacePriceType.flat) {
    return Math.round((params.agreedFlatPrice ?? 0) * params.commissionRate);
  }
  const base =
    (params.agreedPricePerKg ?? 0) * (params.estimatedWeightKg ?? 0);
  return Math.round(base * params.commissionRate);
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

/** Montant à enregistrer en Finance / cheptel à la clôture (offre acceptée ou règlement escrow). */
export function resolveHandoverDealTotalPrice(params: {
  offeredPrice: number;
  dtoTotalPrice: number;
  transaction?: {
    finalAmount: { toNumber(): number } | null;
    priceType: MarketplacePriceType;
    agreedPricePerKg: { toNumber(): number } | null;
    agreedFlatPrice: { toNumber(): number } | null;
    realWeightKg: { toNumber(): number } | null;
    arbitrationWeightKg: { toNumber(): number } | null;
  } | null;
}): number {
  if (params.transaction) {
    if (params.transaction.finalAmount != null) {
      const final = params.transaction.finalAmount.toNumber();
      if (final > 0) {
        return final;
      }
    }
    const computed = calculateFinalAmount(params.transaction);
    if (computed > 0) {
      return computed;
    }
  }
  if (params.offeredPrice > 0) {
    return params.offeredPrice;
  }
  if (params.dtoTotalPrice > 0) {
    return params.dtoTotalPrice;
  }
  return 0;
}

/** Poids réel déclaré à la réception (somme par sujet ou total). */
export function resolveReceiptRealWeightKg(params: {
  existingRealWeightKg: number | null;
  realWeightKg?: number;
  animalWeights?: { weightKg: number }[];
}): number | null {
  if (params.animalWeights?.length) {
    const sum = params.animalWeights.reduce((acc, row) => acc + row.weightKg, 0);
    if (sum > 0 && Number.isFinite(sum)) {
      return sum;
    }
  }
  if (
    params.realWeightKg != null &&
    Number.isFinite(params.realWeightKg) &&
    params.realWeightKg > 0
  ) {
    return params.realWeightKg;
  }
  if (
    params.existingRealWeightKg != null &&
    params.existingRealWeightKg > 0
  ) {
    return params.existingRealWeightKg;
  }
  return null;
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
  /** true = acheteur a payé le prix + commission (nouveau comportement) */
  buyerPaysCommission?: boolean;
  /** Taux de commission prélevée sur le vendeur (0 = aucun). */
  sellerCommissionRate?: number;
}): {
  commissionAmount: number;
  sellerCommissionAmount: number;
  totalCommissionAmount: number;
  sellerReceivedAmount: number;
  buyerRefundAmount: number;
  buyerAdditionalCharge: number;
} {
  const commissionAmount = Math.round(params.finalAmount * params.commissionRate);
  const sellerCommissionAmount = Math.round(
    params.finalAmount * (params.sellerCommissionRate ?? 0)
  );
  const totalCommissionAmount = commissionAmount + sellerCommissionAmount;

  if (params.buyerPaysCommission) {
    // Acheteur paye prix + frais acheteur → vendeur reçoit prix total moins ses propres frais
    const sellerReceivedAmount = params.finalAmount - sellerCommissionAmount;
    const buyerTotalOwed = params.finalAmount + commissionAmount;
    const delta = params.blockedAmount - buyerTotalOwed;
    const buyerRefundAmount = delta > 0 ? delta : 0;
    const buyerAdditionalCharge = delta < 0 ? Math.abs(delta) : 0;
    return {
      commissionAmount,
      sellerCommissionAmount,
      totalCommissionAmount,
      sellerReceivedAmount,
      buyerRefundAmount,
      buyerAdditionalCharge
    };
  }
  // Comportement historique : commission acheteur + commission vendeur toutes deux déduites du vendeur
  const sellerReceivedAmount = params.finalAmount - commissionAmount - sellerCommissionAmount;
  const delta = params.blockedAmount - params.finalAmount;
  const buyerRefundAmount = delta > 0 ? delta : 0;
  const buyerAdditionalCharge = delta < 0 ? Math.abs(delta) : 0;
  return {
    commissionAmount,
    sellerCommissionAmount,
    totalCommissionAmount,
    sellerReceivedAmount,
    buyerRefundAmount,
    buyerAdditionalCharge
  };
}

export const TERMINAL_TRANSACTION_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.TRANSACTION_CLOSED,
  MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
  MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
  MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
  MarketplaceTransactionStatus.OFFER_EXPIRED,
  MarketplaceTransactionStatus.PAYMENT_FAILED
];

/** Transaction en cours (bloque de nouvelles offres sur l'annonce). */
export const ACTIVE_DEAL_TRANSACTION_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_PROPOSED,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED,
  MarketplaceTransactionStatus.BUYER_RECEIVED,
  MarketplaceTransactionStatus.DELIVERY_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED
];

export const ACTIVE_ESCROW_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_PROPOSED,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED,
  MarketplaceTransactionStatus.BUYER_RECEIVED,
  MarketplaceTransactionStatus.DELIVERY_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED
];

export const SHIPMENT_CONFIRM_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.WEIGHT_VALIDATED
];

export const PICKUP_CONFIRM_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PICKUP_PROPOSED
];

/** Statuts bloquant la modification d'une annonce (escrow + paiement en attente). */
export const LISTING_EDIT_LOCK_STATUSES: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  ...ACTIVE_ESCROW_STATUSES
];

export const CANCELLABLE_BY_BUYER: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_PROPOSED,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED,
  MarketplaceTransactionStatus.SELLER_SHIPPED
];

export const CANCELLABLE_BY_SELLER: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_PENDING,
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_PROPOSED,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED,
  MarketplaceTransactionStatus.SELLER_SHIPPED
];
