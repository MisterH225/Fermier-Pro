import type { OrderStatusTone } from "../components/orders";

export const MARKETPLACE_TRANSACTION_STATUSES = [
  "OFFER_ACCEPTED",
  "PAYMENT_PENDING",
  "PAYMENT_HELD",
  "PICKUP_PROPOSED",
  "PICKUP_SCHEDULED",
  "SELLER_SHIPPED",
  "BUYER_RECEIVED",
  "DELIVERY_DISPUTED",
  "WEIGHT_DECLARED",
  "WEIGHT_COUNTER_DECLARED",
  "WEIGHT_DISPUTED",
  "WEIGHT_VALIDATED",
  "TRANSACTION_CLOSED",
  "CANCELLED_BY_BUYER",
  "CANCELLED_BY_SELLER",
  "CANCELLED_SOLD_TO_OTHER",
  "PAYMENT_FAILED",
  "OFFER_EXPIRED"
] as const;

export type MarketplaceTransactionStatusUi =
  (typeof MARKETPLACE_TRANSACTION_STATUSES)[number];

export type MarketplaceTransactionRole = "buyer" | "seller";

export type MarketplaceTransactionAction =
  | "pay"
  | "propose_pickup"
  | "confirm_pickup"
  | "declare_weight"
  | "validate_weight"
  | "counter_weight"
  | "request_weight_arbitration"
  | "confirm_shipment"
  | "confirm_receipt"
  | "cancel"
  | "complete_transfer";

export type MarketplaceTransactionStage =
  | "order"
  | "payment"
  | "delivery"
  | "receipt_weighing"
  | "closed"
  | "cancelled";

type StatusUi = {
  labelKey: string;
  tone: OrderStatusTone;
  stage: MarketplaceTransactionStage;
  stageIndex: number;
  disputedIndex?: number;
};

/**
 * Copie mobile volontairement alignée sur
 * apps/api/src/marketplace/orders/order-stage.ts.
 * L'ancien DTO de détail ne fournit pas encore stage/stageIndex.
 */
export const MARKETPLACE_STATUS_UI: Record<
  MarketplaceTransactionStatusUi,
  StatusUi
> = {
  OFFER_ACCEPTED: {
    labelKey: "marketScreen.transaction.shortStatus.OFFER_ACCEPTED",
    tone: "pending",
    stage: "order",
    stageIndex: 0
  },
  PAYMENT_PENDING: {
    labelKey: "marketScreen.transaction.shortStatus.PAYMENT_PENDING",
    tone: "pending",
    stage: "payment",
    stageIndex: 1
  },
  PAYMENT_FAILED: {
    labelKey: "marketScreen.transaction.shortStatus.PAYMENT_FAILED",
    tone: "danger",
    stage: "payment",
    stageIndex: 1
  },
  PAYMENT_HELD: {
    labelKey: "marketScreen.transaction.shortStatus.PAYMENT_HELD",
    tone: "active",
    stage: "delivery",
    stageIndex: 2
  },
  PICKUP_PROPOSED: {
    labelKey: "marketScreen.transaction.shortStatus.PICKUP_PROPOSED",
    tone: "pending",
    stage: "delivery",
    stageIndex: 2
  },
  PICKUP_SCHEDULED: {
    labelKey: "marketScreen.transaction.shortStatus.PICKUP_SCHEDULED",
    tone: "active",
    stage: "delivery",
    stageIndex: 2
  },
  SELLER_SHIPPED: {
    labelKey: "marketScreen.transaction.shortStatus.SELLER_SHIPPED",
    tone: "active",
    stage: "delivery",
    stageIndex: 2
  },
  DELIVERY_DISPUTED: {
    labelKey: "marketScreen.transaction.shortStatus.DELIVERY_DISPUTED",
    tone: "danger",
    stage: "delivery",
    stageIndex: 2,
    disputedIndex: 2
  },
  BUYER_RECEIVED: {
    labelKey: "marketScreen.transaction.shortStatus.BUYER_RECEIVED",
    tone: "active",
    stage: "receipt_weighing",
    stageIndex: 3
  },
  WEIGHT_DECLARED: {
    labelKey: "marketScreen.transaction.shortStatus.WEIGHT_DECLARED",
    tone: "pending",
    stage: "receipt_weighing",
    stageIndex: 3
  },
  WEIGHT_COUNTER_DECLARED: {
    labelKey: "marketScreen.transaction.shortStatus.WEIGHT_COUNTER_DECLARED",
    tone: "pending",
    stage: "receipt_weighing",
    stageIndex: 3
  },
  WEIGHT_DISPUTED: {
    labelKey: "marketScreen.transaction.shortStatus.WEIGHT_DISPUTED",
    tone: "danger",
    stage: "receipt_weighing",
    stageIndex: 3,
    disputedIndex: 3
  },
  WEIGHT_VALIDATED: {
    labelKey: "marketScreen.transaction.shortStatus.WEIGHT_VALIDATED",
    tone: "active",
    stage: "receipt_weighing",
    stageIndex: 3
  },
  TRANSACTION_CLOSED: {
    labelKey: "marketScreen.transaction.shortStatus.TRANSACTION_CLOSED",
    tone: "success",
    stage: "closed",
    stageIndex: 4
  },
  CANCELLED_BY_BUYER: {
    labelKey: "marketScreen.transaction.shortStatus.CANCELLED_BY_BUYER",
    tone: "neutral",
    stage: "cancelled",
    stageIndex: -1
  },
  CANCELLED_BY_SELLER: {
    labelKey: "marketScreen.transaction.shortStatus.CANCELLED_BY_SELLER",
    tone: "neutral",
    stage: "cancelled",
    stageIndex: -1
  },
  CANCELLED_SOLD_TO_OTHER: {
    labelKey: "marketScreen.transaction.shortStatus.CANCELLED_SOLD_TO_OTHER",
    tone: "neutral",
    stage: "cancelled",
    stageIndex: -1
  },
  OFFER_EXPIRED: {
    labelKey: "marketScreen.transaction.shortStatus.OFFER_EXPIRED",
    tone: "neutral",
    stage: "cancelled",
    stageIndex: -1
  }
};

export function marketplaceStatusUi(status: string): StatusUi {
  return (
    MARKETPLACE_STATUS_UI[status as MarketplaceTransactionStatusUi] ?? {
      labelKey: "marketScreen.transaction.shortStatus.unknown",
      tone: "neutral",
      stage: "order",
      stageIndex: 0
    }
  );
}

/**
 * Table de non-régression de l'interface historique. Elle décrit uniquement les
 * boutons visibles avant le re-skin ; les gardes dynamiques restent au parent.
 */
const ACTIONS_BY_STATUS: Record<
  MarketplaceTransactionStatusUi,
  Record<MarketplaceTransactionRole, readonly MarketplaceTransactionAction[]>
> = {
  OFFER_ACCEPTED: { buyer: [], seller: [] },
  PAYMENT_PENDING: {
    buyer: ["pay", "cancel"],
    seller: ["cancel"]
  },
  PAYMENT_HELD: {
    buyer: ["propose_pickup", "cancel"],
    seller: ["cancel"]
  },
  PICKUP_PROPOSED: {
    buyer: [],
    seller: ["confirm_pickup"]
  },
  PICKUP_SCHEDULED: {
    buyer: ["declare_weight", "cancel"],
    seller: ["cancel"]
  },
  SELLER_SHIPPED: {
    buyer: ["confirm_receipt", "cancel"],
    seller: ["cancel"]
  },
  BUYER_RECEIVED: { buyer: [], seller: [] },
  DELIVERY_DISPUTED: { buyer: [], seller: [] },
  WEIGHT_DECLARED: {
    buyer: [],
    seller: ["validate_weight", "counter_weight"]
  },
  WEIGHT_COUNTER_DECLARED: {
    buyer: ["request_weight_arbitration"],
    seller: [
      "validate_weight",
      "request_weight_arbitration"
    ]
  },
  WEIGHT_DISPUTED: { buyer: [], seller: [] },
  WEIGHT_VALIDATED: {
    buyer: [],
    seller: ["confirm_shipment"]
  },
  TRANSACTION_CLOSED: {
    buyer: ["complete_transfer"],
    seller: []
  },
  CANCELLED_BY_BUYER: { buyer: [], seller: [] },
  CANCELLED_BY_SELLER: { buyer: [], seller: [] },
  CANCELLED_SOLD_TO_OTHER: { buyer: [], seller: [] },
  PAYMENT_FAILED: { buyer: ["pay"], seller: [] },
  OFFER_EXPIRED: { buyer: [], seller: [] }
};

export function marketplaceTransactionActions(
  status: string,
  role: MarketplaceTransactionRole
): readonly MarketplaceTransactionAction[] {
  return (
    ACTIONS_BY_STATUS[status as MarketplaceTransactionStatusUi]?.[role] ?? []
  );
}

export function marketplaceTransactionReference(id: string): string {
  return `TX-${id.replace(/-/g, "").slice(-8).toUpperCase()}`;
}

export function marketplaceTransactionDeadlineAt(transaction: {
  status: string;
  offerExpiresAt?: string | null;
  sellerShippedAt?: string | null;
}): string | null {
  if (
    ["OFFER_ACCEPTED", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(
      transaction.status
    )
  ) {
    return transaction.offerExpiresAt ?? null;
  }
  if (transaction.status === "SELLER_SHIPPED" && transaction.sellerShippedAt) {
    const deadline = new Date(transaction.sellerShippedAt);
    if (!Number.isNaN(deadline.getTime())) {
      deadline.setDate(deadline.getDate() + 14);
      return deadline.toISOString();
    }
  }
  return null;
}
