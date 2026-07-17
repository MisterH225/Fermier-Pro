import type { MerchantOrderDto } from "./api";

/** Étapes horizontales du suivi (design packing / livraison). */
export type OrderProgressStepKey = "received" | "in_transit" | "delivered";

export type OrderProgressStep = {
  key: OrderProgressStepKey;
  /** Statut métier atteint pour considérer l’étape « done ». */
  reachedFrom: string[];
  /** Horodatage source sur la commande. */
  stampField: keyof Pick<
    MerchantOrderDto,
    "paidAt" | "confirmedAt" | "shippedAt" | "deliveredAt" | "completedAt"
  >;
};

export const ORDER_PROGRESS_STEPS: OrderProgressStep[] = [
  {
    key: "received",
    reachedFrom: ["paid", "confirmed", "shipping", "delivered", "completed", "disputed"],
    stampField: "paidAt"
  },
  {
    key: "in_transit",
    reachedFrom: ["shipping", "delivered", "completed", "disputed"],
    stampField: "shippedAt"
  },
  {
    key: "delivered",
    reachedFrom: ["delivered", "completed"],
    stampField: "deliveredAt"
  }
];

const STATUS_RANK = [
  "payment_pending",
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "completed"
] as const;

export type OrderStatusBadgeTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

export function shortOrderTrackingId(orderId: string): string {
  const tail = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `CMD-${tail.slice(0, 3)}-${tail.slice(3)}`;
}

export function isTerminalNegativeStatus(status: string): boolean {
  return (
    status === "rejected" ||
    status === "auto_rejected" ||
    status === "refunded" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function isProgressStepDone(status: string, step: OrderProgressStep): boolean {
  if (isTerminalNegativeStatus(status)) {
    return step.key === "received" && status !== "failed";
  }
  return step.reachedFrom.includes(status);
}

export function isProgressStepCurrent(status: string, stepKey: OrderProgressStepKey): boolean {
  if (isTerminalNegativeStatus(status)) return false;
  if (status === "disputed") return stepKey === "in_transit";
  if (status === "payment_pending" || status === "paid" || status === "confirmed") {
    return stepKey === "received";
  }
  if (status === "shipping") return stepKey === "in_transit";
  if (status === "delivered" || status === "completed") return stepKey === "delivered";
  return false;
}

export function orderStatusBadgeTone(status: string): OrderStatusBadgeTone {
  switch (status) {
    case "shipping":
      return "progress";
    case "delivered":
    case "completed":
      return "success";
    case "paid":
    case "confirmed":
    case "payment_pending":
      return "info";
    case "disputed":
      return "warning";
    case "rejected":
    case "auto_rejected":
    case "refunded":
    case "failed":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export type OrderActivityEvent = {
  id: string;
  at: string;
  statusTo: string;
  note: string | null;
};

/**
 * Journal d’activité : préfère `timeline` API, sinon reconstruit depuis les timestamps.
 */
export function buildOrderActivityEvents(order: MerchantOrderDto): OrderActivityEvent[] {
  if (order.timeline && order.timeline.length > 0) {
    return [...order.timeline]
      .filter((e) => e.toStatus)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => ({
        id: e.id,
        at: e.createdAt,
        statusTo: e.toStatus,
        note: e.note
      }));
  }

  const stamps: Array<{ statusTo: string; at: string | null | undefined }> = [
    { statusTo: "paid", at: order.paidAt },
    { statusTo: "confirmed", at: order.confirmedAt },
    { statusTo: "shipping", at: order.shippedAt },
    { statusTo: "delivered", at: order.deliveredAt },
    { statusTo: "completed", at: order.completedAt },
    { statusTo: "rejected", at: order.rejectedAt },
    { statusTo: "disputed", at: order.disputeOpenedAt }
  ];

  return stamps
    .filter((s): s is { statusTo: string; at: string } => Boolean(s.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((s) => ({
      id: `${s.statusTo}-${s.at}`,
      at: s.at,
      statusTo: s.statusTo,
      note: null
    }));
}

export function statusRankIndex(status: string): number {
  return (STATUS_RANK as readonly string[]).indexOf(status);
}
