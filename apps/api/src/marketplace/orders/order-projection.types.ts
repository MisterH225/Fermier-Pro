import type { OrderActionActor } from "./order-action-required";
import type { OrderStage } from "./order-stage";

export type OrderProjectionType = "escrow" | "shop";

export type OrderListSegment =
  | "action_required"
  | "active"
  | "closed"
  | "disputed";

export interface OrderProjectionCard {
  id: string;
  type: OrderProjectionType;
  reference: string;
  status: string;
  stage: OrderStage;
  stageIndex: number;
  disputed: boolean;
  actionRequiredBy: OrderActionActor;
  nextActionKey: string | null;
  deadlineAt: string | null;
  timeoutOutcomeKey: string | null;
  counterparty: { displayName: string };
  itemSummary: string;
  amount: number;
  currency: string;
  updatedAt: string;
}

export interface OrdersListResponse {
  items: OrderProjectionCard[];
  nextCursor: string | null;
}

export interface OrdersCountersResponse {
  actionRequired: number;
  active: number;
  disputed: number;
  pendingProposals: number;
}

/** Délai auto-validation poids (miroir cron marketplace). */
export const WEIGHT_AUTO_VALIDATE_MS = 24 * 60 * 60 * 1000;
/** Délai litige livraison auto (miroir cron marketplace). */
export const DELIVERY_DISPUTE_AUTO_MS = 14 * 24 * 60 * 60 * 1000;
