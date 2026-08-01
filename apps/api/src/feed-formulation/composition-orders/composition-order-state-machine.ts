import { CompositionOrderStatus } from "@prisma/client";

/**
 * Événements de la machine à états commande composition (P-J4-B).
 * Modèle calqué sur transaction-state-machine.ts.
 */
export const COMPOSITION_ORDER_EVENTS = [
  "MILL_REVISE",
  "PRODUCER_ACCEPT",
  "PRODUCER_REJECT",
  "PRODUCER_CANCEL",
  "PAYMENT_CONFIRMED",
  "START_PRODUCTION",
  "MARK_READY",
  "MARK_OUT_FOR_DELIVERY",
  "COMPLETE"
] as const;

export type CompositionOrderEvent =
  (typeof COMPOSITION_ORDER_EVENTS)[number];

export type CompositionOrderActor = "producer" | "mill" | "system";

export interface CompositionOrderTransitionDefinition {
  from: CompositionOrderStatus;
  event: CompositionOrderEvent;
  to: CompositionOrderStatus;
  actors: readonly CompositionOrderActor[];
}

export interface CompositionOrderTransitionResult {
  allowed: boolean;
  to: CompositionOrderStatus | null;
}

/**
 * Table des transitions autorisées.
 * PAID → IN_PRODUCTION = point de non-retour (pas d'annulation libre).
 * COMPLETED / OUT_FOR_DELIVERY = J5 (présents pour forward-compat).
 */
export const COMPOSITION_ORDER_TRANSITIONS: readonly CompositionOrderTransitionDefinition[] =
  [
    {
      from: CompositionOrderStatus.SENT_TO_MILL,
      event: "MILL_REVISE",
      to: CompositionOrderStatus.MILL_REVISED,
      actors: ["mill"]
    },
    {
      from: CompositionOrderStatus.SENT_TO_MILL,
      event: "PRODUCER_CANCEL",
      to: CompositionOrderStatus.CANCELLED,
      actors: ["producer"]
    },
    {
      from: CompositionOrderStatus.MILL_REVISED,
      event: "MILL_REVISE",
      to: CompositionOrderStatus.MILL_REVISED,
      actors: ["mill"]
    },
    {
      from: CompositionOrderStatus.MILL_REVISED,
      event: "PRODUCER_ACCEPT",
      to: CompositionOrderStatus.ACCEPTED,
      actors: ["producer"]
    },
    {
      from: CompositionOrderStatus.MILL_REVISED,
      event: "PRODUCER_REJECT",
      to: CompositionOrderStatus.REJECTED,
      actors: ["producer"]
    },
    {
      from: CompositionOrderStatus.MILL_REVISED,
      event: "PRODUCER_CANCEL",
      to: CompositionOrderStatus.CANCELLED,
      actors: ["producer"]
    },
    {
      from: CompositionOrderStatus.ACCEPTED,
      event: "PAYMENT_CONFIRMED",
      to: CompositionOrderStatus.PAID,
      actors: ["producer", "system"]
    },
    {
      from: CompositionOrderStatus.ACCEPTED,
      event: "PRODUCER_CANCEL",
      to: CompositionOrderStatus.CANCELLED,
      actors: ["producer"]
    },
    {
      from: CompositionOrderStatus.PAID,
      event: "START_PRODUCTION",
      to: CompositionOrderStatus.IN_PRODUCTION,
      actors: ["mill"]
    },
    {
      from: CompositionOrderStatus.IN_PRODUCTION,
      event: "MARK_READY",
      to: CompositionOrderStatus.READY_FOR_PICKUP,
      actors: ["mill"]
    },
    {
      from: CompositionOrderStatus.IN_PRODUCTION,
      event: "MARK_OUT_FOR_DELIVERY",
      to: CompositionOrderStatus.OUT_FOR_DELIVERY,
      actors: ["mill"]
    },
    // J5 — placeholders pour ne pas bloquer le hub
    {
      from: CompositionOrderStatus.READY_FOR_PICKUP,
      event: "COMPLETE",
      to: CompositionOrderStatus.COMPLETED,
      actors: ["producer", "system"]
    },
    {
      from: CompositionOrderStatus.OUT_FOR_DELIVERY,
      event: "COMPLETE",
      to: CompositionOrderStatus.COMPLETED,
      actors: ["producer", "system"]
    }
  ];

export function canTransitionCompositionOrder(
  from: CompositionOrderStatus,
  event: CompositionOrderEvent,
  actor?: CompositionOrderActor
): CompositionOrderTransitionResult {
  const match = COMPOSITION_ORDER_TRANSITIONS.find(
    (t) => t.from === from && t.event === event
  );
  if (!match) {
    return { allowed: false, to: null };
  }
  if (actor != null && !match.actors.includes(actor)) {
    return { allowed: false, to: null };
  }
  return { allowed: true, to: match.to };
}

export function getAllowedCompositionOrderTransitions(
  from: CompositionOrderStatus
): CompositionOrderTransitionDefinition[] {
  return COMPOSITION_ORDER_TRANSITIONS.filter((t) => t.from === from);
}

/** Annulation libre uniquement avant paiement (pas d'escrow à rembourser). */
export function canCancelCompositionOrderWithoutRefund(
  status: CompositionOrderStatus
): boolean {
  return (
    status === CompositionOrderStatus.SENT_TO_MILL ||
    status === CompositionOrderStatus.MILL_REVISED ||
    status === CompositionOrderStatus.ACCEPTED
  );
}

/** Après démarrage production : annulation libre interdite (litige J5). */
export function isCompositionOrderPastPointOfNoReturn(
  status: CompositionOrderStatus
): boolean {
  return (
    status === CompositionOrderStatus.IN_PRODUCTION ||
    status === CompositionOrderStatus.READY_FOR_PICKUP ||
    status === CompositionOrderStatus.OUT_FOR_DELIVERY ||
    status === CompositionOrderStatus.COMPLETED
  );
}
