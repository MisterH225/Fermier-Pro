import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  OfferStatus
} from "@prisma/client";
import { MERCHANT_ORDER_DISPUTE_WINDOW_MS } from "../merchant-shop/merchant-shop.constants";
import {
  DELIVERY_DISPUTE_AUTO_MS,
  WEIGHT_AUTO_VALIDATE_MS
} from "../marketplace/orders/order-projection.types";

/**
 * Clés i18n de conséquence d'échéance (P-43).
 *
 * IMPORTANT (contrainte morale du prompt) : chaque clé décrit le comportement
 * RÉEL du cron correspondant, pas une promesse marketing. Voir l'inventaire
 * P-43 et les crons dans marketplace-transaction.service.ts,
 * merchant-orders.service.ts et credit-offers.service.ts.
 *
 * - offerPaymentExpire : PAYMENT_PENDING → OFFER_EXPIRED à offerExpiresAt (48h).
 *   Rien n'est bloqué → aucun remboursement, l'annonce est remise en vente.
 * - weightAutoValidate : WEIGHT_DECLARED → WEIGHT_VALIDATED (24h) au poids
 *   déclaré. L'argent reste gardé.
 * - deliveryAutoDispute : SELLER_SHIPPED → DELIVERY_DISPUTED (14j). Ouvre un
 *   problème, l'argent reste gardé, Fermier Pro examine.
 * - shopConfirmRefund : commande boutique paid → refunded (24h). Argent
 *   remboursé à l'acheteur.
 * - shopAutoComplete : commande boutique delivered → completed (48h). Le
 *   vendeur est payé (release escrow).
 * - creditBalanceArbitration : solde crédit → arbitration (J+2 après échéance).
 *   Fermier Pro examine, pas de remboursement automatique.
 * - offerProposalExpire : offre pending/countered → rejected (7j). Pas de
 *   transaction, rien à rembourser.
 */
export const DEADLINE_OUTCOME_KEY = {
  offerPaymentExpire: "deadline.outcome.offerPaymentExpire",
  weightAutoValidate: "deadline.outcome.weightAutoValidate",
  deliveryAutoDispute: "deadline.outcome.deliveryAutoDispute",
  shopConfirmRefund: "deadline.outcome.shopConfirmRefund",
  shopAutoComplete: "deadline.outcome.shopAutoComplete",
  creditBalanceArbitration: "deadline.outcome.creditBalanceArbitration",
  offerProposalExpire: "deadline.outcome.offerProposalExpire"
} as const;

export type DeadlineOutcomeKey =
  (typeof DEADLINE_OUTCOME_KEY)[keyof typeof DEADLINE_OUTCOME_KEY];

/**
 * Conséquence d'un timeout escrow marketplace, ou null si l'état n'a pas de
 * cron automatique (ex. PAYMENT_FAILED — anomalie inventoriée : pas de cron).
 */
export function escrowTimeoutOutcomeKey(
  status: MarketplaceTransactionStatus
): DeadlineOutcomeKey | null {
  switch (status) {
    case MarketplaceTransactionStatus.PAYMENT_PENDING:
      return DEADLINE_OUTCOME_KEY.offerPaymentExpire;
    case MarketplaceTransactionStatus.WEIGHT_DECLARED:
      return DEADLINE_OUTCOME_KEY.weightAutoValidate;
    case MarketplaceTransactionStatus.SELLER_SHIPPED:
      return DEADLINE_OUTCOME_KEY.deliveryAutoDispute;
    default:
      return null;
  }
}

/** Conséquence d'un timeout commande boutique, ou null. */
export function shopTimeoutOutcomeKey(
  status: MerchantOrderStatus
): DeadlineOutcomeKey | null {
  switch (status) {
    case MerchantOrderStatus.paid:
      return DEADLINE_OUTCOME_KEY.shopConfirmRefund;
    case MerchantOrderStatus.delivered:
      return DEADLINE_OUTCOME_KEY.shopAutoComplete;
    default:
      return null;
  }
}

/** Conséquence de l'échéance du solde crédit (arbitrage à J+2). */
export function creditBalanceTimeoutOutcomeKey(): DeadlineOutcomeKey {
  return DEADLINE_OUTCOME_KEY.creditBalanceArbitration;
}

/** Conséquence de l'expiration d'une offre non traitée (7j). */
export function offerProposalTimeoutOutcomeKey(
  status: OfferStatus
): DeadlineOutcomeKey | null {
  if (status === OfferStatus.pending || status === OfferStatus.countered) {
    return DEADLINE_OUTCOME_KEY.offerProposalExpire;
  }
  return null;
}

/**
 * Échéance automatique d'une transaction escrow, ou null.
 *
 * PAYMENT_FAILED est volontairement exclu (aucun cron ne l'expire — anomalie
 * inventoriée P-43) : on n'affiche pas d'échéance qu'aucun cron ne tiendra.
 */
export function escrowDeadlineAt(tx: {
  status: MarketplaceTransactionStatus;
  offerExpiresAt: Date;
  weightDeclaredByBuyerAt: Date | null;
  sellerShippedAt: Date | null;
}): Date | null {
  if (tx.status === MarketplaceTransactionStatus.PAYMENT_PENDING) {
    return tx.offerExpiresAt;
  }
  if (
    tx.status === MarketplaceTransactionStatus.WEIGHT_DECLARED &&
    tx.weightDeclaredByBuyerAt
  ) {
    return new Date(
      tx.weightDeclaredByBuyerAt.getTime() + WEIGHT_AUTO_VALIDATE_MS
    );
  }
  if (
    tx.status === MarketplaceTransactionStatus.SELLER_SHIPPED &&
    tx.sellerShippedAt
  ) {
    return new Date(tx.sellerShippedAt.getTime() + DELIVERY_DISPUTE_AUTO_MS);
  }
  return null;
}

/** Échéance automatique d'une commande boutique, ou null. */
export function shopDeadlineAt(order: {
  status: MerchantOrderStatus;
  timeoutAt: Date | null;
  deliveredAt: Date | null;
}): Date | null {
  if (order.status === MerchantOrderStatus.paid && order.timeoutAt) {
    return order.timeoutAt;
  }
  if (order.status === MerchantOrderStatus.delivered && order.deliveredAt) {
    return new Date(
      order.deliveredAt.getTime() + MERCHANT_ORDER_DISPUTE_WINDOW_MS
    );
  }
  return null;
}
