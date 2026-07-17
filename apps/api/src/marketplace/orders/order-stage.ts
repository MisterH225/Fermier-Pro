import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus
} from "@prisma/client";

/** Macro-étapes du stepper « Mes commandes ». */
export const ORDER_STAGES = [
  "order",
  "payment",
  "delivery",
  "receipt_weighing",
  "closed",
  "cancelled"
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

/** Index d’étape pour le stepper (cancelled hors flux nominal). */
export const ORDER_STAGE_INDEX: Readonly<Record<OrderStage, number>> = {
  order: 0,
  payment: 1,
  delivery: 2,
  receipt_weighing: 3,
  closed: 4,
  cancelled: -1
};

const ESCROW_STAGE_BY_STATUS: Readonly<
  Record<MarketplaceTransactionStatus, OrderStage>
> = {
  [MarketplaceTransactionStatus.OFFER_ACCEPTED]: "order",
  [MarketplaceTransactionStatus.PAYMENT_PENDING]: "payment",
  [MarketplaceTransactionStatus.PAYMENT_FAILED]: "payment",
  [MarketplaceTransactionStatus.PAYMENT_HELD]: "delivery",
  [MarketplaceTransactionStatus.PICKUP_PROPOSED]: "delivery",
  [MarketplaceTransactionStatus.PICKUP_SCHEDULED]: "delivery",
  [MarketplaceTransactionStatus.SELLER_SHIPPED]: "delivery",
  [MarketplaceTransactionStatus.DELIVERY_DISPUTED]: "delivery",
  [MarketplaceTransactionStatus.WEIGHT_DECLARED]: "receipt_weighing",
  [MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED]: "receipt_weighing",
  [MarketplaceTransactionStatus.WEIGHT_DISPUTED]: "receipt_weighing",
  [MarketplaceTransactionStatus.WEIGHT_VALIDATED]: "receipt_weighing",
  [MarketplaceTransactionStatus.BUYER_RECEIVED]: "receipt_weighing",
  [MarketplaceTransactionStatus.TRANSACTION_CLOSED]: "closed",
  [MarketplaceTransactionStatus.CANCELLED_BY_BUYER]: "cancelled",
  [MarketplaceTransactionStatus.CANCELLED_BY_SELLER]: "cancelled",
  [MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER]: "cancelled",
  [MarketplaceTransactionStatus.OFFER_EXPIRED]: "cancelled"
};

const SHOP_STAGE_BY_STATUS: Readonly<Record<MerchantOrderStatus, OrderStage>> =
  {
    [MerchantOrderStatus.payment_pending]: "payment",
    [MerchantOrderStatus.paid]: "order",
    [MerchantOrderStatus.confirmed]: "delivery",
    [MerchantOrderStatus.shipping]: "delivery",
    [MerchantOrderStatus.delivered]: "receipt_weighing",
    [MerchantOrderStatus.completed]: "closed",
    [MerchantOrderStatus.rejected]: "cancelled",
    [MerchantOrderStatus.auto_rejected]: "cancelled",
    [MerchantOrderStatus.refunded]: "cancelled",
    [MerchantOrderStatus.disputed]: "delivery",
    [MerchantOrderStatus.cancelled]: "cancelled",
    [MerchantOrderStatus.failed]: "cancelled"
  };

export function stageOfEscrow(
  status: MarketplaceTransactionStatus
): OrderStage {
  return ESCROW_STAGE_BY_STATUS[status];
}

export function stageOfShop(status: MerchantOrderStatus): OrderStage {
  return SHOP_STAGE_BY_STATUS[status];
}

export function stageIndexOf(stage: OrderStage): number {
  return ORDER_STAGE_INDEX[stage];
}

export function isEscrowDisputed(
  status: MarketplaceTransactionStatus
): boolean {
  return (
    status === MarketplaceTransactionStatus.DELIVERY_DISPUTED ||
    status === MarketplaceTransactionStatus.WEIGHT_DISPUTED
  );
}

export function isShopDisputed(status: MerchantOrderStatus): boolean {
  return status === MerchantOrderStatus.disputed;
}

export function isEscrowClosedOrCancelled(
  status: MarketplaceTransactionStatus
): boolean {
  const stage = stageOfEscrow(status);
  return stage === "closed" || stage === "cancelled";
}

export function isShopClosedOrCancelled(status: MerchantOrderStatus): boolean {
  const stage = stageOfShop(status);
  return stage === "closed" || stage === "cancelled";
}
