import type { MerchantOrderDto } from "./api";
import {
  ORDER_PROGRESS_STEPS,
  isProgressStepCurrent,
  isProgressStepDone,
  shortOrderTrackingId,
  type OrderProgressStepKey
} from "./merchantOrderTracking";
import type { OrderStatusTone } from "../components/orders";

/** Statuts encore en cours (suivi utile sur le dashboard). */
export const ACTIVE_ORDER_TRACKING_STATUSES = new Set([
  "payment_pending",
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "disputed"
]);

const STATUS_PRIORITY: Record<string, number> = {
  shipping: 0,
  disputed: 1,
  delivered: 2,
  confirmed: 3,
  paid: 4,
  payment_pending: 5
};

export function isActiveOrderForTracking(order: MerchantOrderDto): boolean {
  return ACTIVE_ORDER_TRACKING_STATUSES.has(order.status);
}

/** Choisit la commande la plus pertinente à afficher sur le dashboard. */
export function pickCurrentTrackingOrder(
  orders: MerchantOrderDto[] | undefined,
  dismissedIds: ReadonlySet<string>
): MerchantOrderDto | null {
  const candidates = (orders ?? []).filter(
    (order) =>
      isActiveOrderForTracking(order) && !dismissedIds.has(order.id)
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  })[0]!;
}

export function trackingReferenceOf(order: MerchantOrderDto): string {
  return shortOrderTrackingId(order.id);
}

export function trackingBadgeTone(status: string): OrderStatusTone {
  switch (status) {
    case "shipping":
    case "confirmed":
      return "active";
    case "delivered":
      return "success";
    case "paid":
    case "payment_pending":
      return "pending";
    case "disputed":
      return "danger";
    default:
      return "neutral";
  }
}

export function trackingBadgeLabelKey(status: string): string {
  switch (status) {
    case "shipping":
      return "ordersTracking.badge.inTransit";
    case "delivered":
      return "ordersTracking.badge.delivered";
    case "disputed":
      return "ordersTracking.badge.disputed";
    case "paid":
    case "payment_pending":
    case "confirmed":
      return "ordersTracking.badge.pickedUp";
    default:
      return `merchant.orders.status.${status}`;
  }
}

export type TrackingParty = {
  labelKey: string;
  value: string;
};

export function trackingParties(
  order: MerchantOrderDto,
  role: "buyer" | "seller",
  fallbacks: { seller: string; buyer: string; product: string }
): { sender: TrackingParty; recipient: TrackingParty } {
  const seller =
    order.sellerName?.trim() ||
    (role === "seller" ? fallbacks.seller : fallbacks.product);
  const buyer =
    order.buyerName?.trim() ||
    (role === "buyer" ? fallbacks.buyer : fallbacks.product);

  return {
    sender: {
      labelKey: "ordersTracking.sender",
      value: seller
    },
    recipient: {
      labelKey: "ordersTracking.recipient",
      value: buyer
    }
  };
}

export type DashboardTrackingStep = {
  key: OrderProgressStepKey;
  labelKey: string;
  done: boolean;
  current: boolean;
  timestamp: string | null;
};

export function buildDashboardTrackingSteps(
  order: MerchantOrderDto
): DashboardTrackingStep[] {
  return ORDER_PROGRESS_STEPS.map((step) => {
    const stamp =
      step.key === "received"
        ? order.paidAt ?? order.confirmedAt
        : step.key === "in_transit"
          ? order.shippedAt
          : order.deliveredAt ?? order.completedAt;
    return {
      key: step.key,
      labelKey: `ordersTracking.steps.${step.key}`,
      done: isProgressStepDone(order.status, step),
      current: isProgressStepCurrent(order.status, step.key),
      timestamp: stamp ?? null
    };
  });
}

export function formatTrackingStepWhen(
  iso: string,
  locale: string
): string {
  try {
    const date = new Date(iso);
    const day = date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short"
    });
    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit"
    });
    return `${day}, ${time}`;
  } catch {
    return iso;
  }
}
