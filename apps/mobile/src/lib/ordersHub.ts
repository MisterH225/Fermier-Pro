import type {
  MarketplaceOrderProjectionCard,
  MarketplaceOrderProjectionType,
  MarketplaceOrderRole,
  MarketplaceOrderSegment
} from "./api/marketplaceOrders";
import type { OrderStatusTone } from "../components/orders/OrderStatusBadge";

export type OrdersHubUiSegment =
  | "action_required"
  | "active"
  | "disputed"
  | "closed";

/** Mapping segment UI → query API (identique aujourd’hui, centralisé pour les tests). */
export function ordersHubSegmentToQuery(
  segment: OrdersHubUiSegment
): MarketplaceOrderSegment {
  return segment;
}

export type OrderDetailRoute =
  | { screen: "MarketplaceTransaction"; params: { transactionId: string } }
  | { screen: "MerchantOrderDetail"; params: { orderId: string } };

export function orderDetailRoute(
  card: Pick<MarketplaceOrderProjectionCard, "id" | "type">
): OrderDetailRoute {
  if (card.type === "shop") {
    return { screen: "MerchantOrderDetail", params: { orderId: card.id } };
  }
  return {
    screen: "MarketplaceTransaction",
    params: { transactionId: card.id }
  };
}

export function orderTypeLabelKey(
  type: MarketplaceOrderProjectionType
): string {
  return type === "shop" ? "orders.hub.type.shop" : "orders.hub.type.escrow";
}

export function orderStatusLabelKey(
  card: Pick<MarketplaceOrderProjectionCard, "type" | "status">
): string {
  if (card.type === "shop") {
    if (card.status === "paid") {
      return "merchant.orders.status.paidBuyer";
    }
    return `merchant.orders.status.${card.status}`;
  }
  return `orders.hub.escrowStatus.${card.status}`;
}

export function orderStatusTone(
  card: Pick<MarketplaceOrderProjectionCard, "status" | "disputed" | "stage">
): OrderStatusTone {
  if (card.disputed || card.status === "disputed" || card.status === "DELIVERY_DISPUTED" || card.status === "WEIGHT_DISPUTED") {
    return "danger";
  }
  if (card.stage === "closed" || card.status === "completed" || card.status === "TRANSACTION_CLOSED") {
    return "success";
  }
  if (
    card.stage === "cancelled" ||
    card.status === "rejected" ||
    card.status === "failed" ||
    card.status === "PAYMENT_FAILED" ||
    card.status === "OFFER_EXPIRED" ||
    String(card.status).startsWith("CANCELLED_")
  ) {
    return "danger";
  }
  if (
    card.status === "payment_pending" ||
    card.status === "PAYMENT_PENDING" ||
    card.status === "paid" ||
    card.status === "PAYMENT_HELD"
  ) {
    return "pending";
  }
  return "active";
}

export function isActionRequiredByViewer(
  card: Pick<MarketplaceOrderProjectionCard, "actionRequiredBy">,
  role: MarketplaceOrderRole
): boolean {
  return card.actionRequiredBy === role;
}

/** Compatibilité anciens onglets BuyerHistory → segment hub. */
export function legacyBuyerHistoryTabToSegment(
  tab: string | undefined
): OrdersHubUiSegment {
  switch (tab) {
    case "proposals":
      return "action_required";
    case "purchases":
    case "shopOrders":
      return "active";
    case "reviews":
      return "closed";
    default:
      return "action_required";
  }
}

export function mapOrderProjectionToCardProps(
  card: MarketplaceOrderProjectionCard,
  role: MarketplaceOrderRole
) {
  return {
    reference: card.reference,
    counterparty: card.counterparty.displayName,
    amount: card.amount,
    currency: card.currency,
    statusLabelKey: orderStatusLabelKey(card),
    statusTone: orderStatusTone(card),
    typeLabelKey: orderTypeLabelKey(card.type),
    actionRequiredByMe: isActionRequiredByViewer(card, role),
    nextActionKey: card.nextActionKey,
    deadlineAt: card.deadlineAt,
    timeoutOutcomeKey: card.timeoutOutcomeKey,
    itemSummary: card.itemSummary
  };
}
