import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus
} from "@prisma/client";
import {
  getAllowedTransitions,
  type MarketplaceTransactionActor,
  type MarketplaceTransactionEvent,
  type TransitionDefinition
} from "../escrow/transaction-state-machine";

export type OrderActionActor = "buyer" | "seller" | "system" | "none";

export type OrderViewerRole = "buyer" | "seller";

export interface ActionRequiredProjection {
  actionRequiredBy: OrderActionActor;
  nextActionKey: string | null;
}

/** Événements hors flux nominal (annulation, échec, litige alternatif). */
const SIDE_PATH_EVENTS = new Set<MarketplaceTransactionEvent>([
  "BUYER_CANCEL",
  "SELLER_CANCEL",
  "CANCELLED_SOLD_TO_OTHER",
  "PAYMENT_FAILED",
  "OFFER_EXPIRED",
  "DELIVERY_DISPUTED",
  "DELIVERY_DISPUTE_AUTO",
  "WEIGHT_ARBITRATION_REQUESTED",
  // Contre-déclaration : alternative à la validation vendeur (flux nominal).
  "WEIGHT_COUNTER_DECLARED"
]);

const HUMAN_ACTORS = new Set<MarketplaceTransactionActor>(["buyer", "seller"]);

const EVENT_TO_ACTION_KEY: Partial<
  Record<MarketplaceTransactionEvent, string>
> = {
  PAYMENT_CONFIRMED: "orders.action.pay",
  PAYMENT_RETRY: "orders.action.retryPayment",
  PICKUP_PROPOSED: "orders.action.proposePickup",
  PICKUP_CONFIRMED: "orders.action.confirmPickup",
  WEIGHT_DECLARED: "orders.action.declareWeight",
  WEIGHT_VALIDATED_BY_SELLER: "orders.action.validateWeight",
  SELLER_SHIPPED: "orders.action.confirmShipment",
  BUYER_RECEIVED: "orders.action.confirmReceipt"
};

/**
 * Priorité explicite du flux nominal quand plusieurs sorties restent après filtrage.
 * Commentaires = choix documentés « qui fait avancer le flux ».
 */
const NOMINAL_EVENT_PREFERENCE: Partial<
  Record<MarketplaceTransactionStatus, MarketplaceTransactionEvent>
> = {
  // Payer (buyer) plutôt qu’échouer / expirer.
  [MarketplaceTransactionStatus.PAYMENT_PENDING]: "PAYMENT_CONFIRMED",
  // Réessayer le paiement.
  [MarketplaceTransactionStatus.PAYMENT_FAILED]: "PAYMENT_RETRY",
  // Proposer un RDV (buyer).
  [MarketplaceTransactionStatus.PAYMENT_HELD]: "PICKUP_PROPOSED",
  // Confirmer le RDV (seller).
  [MarketplaceTransactionStatus.PICKUP_PROPOSED]: "PICKUP_CONFIRMED",
  // Déclarer le poids (buyer).
  [MarketplaceTransactionStatus.PICKUP_SCHEDULED]: "WEIGHT_DECLARED",
  // Valider le poids (seller) plutôt que l’auto-cron.
  [MarketplaceTransactionStatus.WEIGHT_DECLARED]: "WEIGHT_VALIDATED_BY_SELLER",
  // Valider le contre-poids (seller) ; l’arbitrage est un chemin latéral.
  [MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED]:
    "WEIGHT_VALIDATED_BY_SELLER",
  // Expédier (seller) plutôt que settlement crédit système.
  [MarketplaceTransactionStatus.WEIGHT_VALIDATED]: "SELLER_SHIPPED",
  // Confirmer réception (buyer) plutôt qu’ouvrir un litige.
  [MarketplaceTransactionStatus.SELLER_SHIPPED]: "BUYER_RECEIVED",
  // Settlement système (TRANSACTION_SETTLED / CREDIT).
  [MarketplaceTransactionStatus.BUYER_RECEIVED]: "TRANSACTION_SETTLED",
  // Arbitrage admin.
  [MarketplaceTransactionStatus.WEIGHT_DISPUTED]: "WEIGHT_ARBITRATED",
  // Résolution admin (premier événement admin disponible).
  [MarketplaceTransactionStatus.DELIVERY_DISPUTED]: "DELIVERY_DISPUTE_VENDOR_WIN"
};

function pickNominalTransition(
  status: MarketplaceTransactionStatus,
  transitions: readonly TransitionDefinition[]
): TransitionDefinition | null {
  const preferred = NOMINAL_EVENT_PREFERENCE[status];
  if (preferred) {
    const hit = transitions.find((t) => t.event === preferred);
    if (hit) return hit;
  }

  const nominal = transitions.filter((t) => !SIDE_PATH_EVENTS.has(t.event));
  if (nominal.length === 0) {
    return null;
  }

  const withHuman = nominal.filter((t) =>
    t.actors.some((a) => HUMAN_ACTORS.has(a))
  );
  return (withHuman[0] ?? nominal[0]) ?? null;
}

function actorFromTransition(
  transition: TransitionDefinition
): OrderActionActor {
  const hasBuyer = transition.actors.includes("buyer");
  const hasSeller = transition.actors.includes("seller");
  if (hasBuyer && !hasSeller) return "buyer";
  if (hasSeller && !hasBuyer) return "seller";
  if (hasBuyer) return "buyer";
  if (hasSeller) return "seller";
  return "system";
}

/**
 * Dérive qui doit agir et la clé i18n d’action à partir de la machine à états.
 * `role` = viewer (signature API) ; `actionRequiredBy` est absolu.
 */
export function deriveActionRequired(
  status: MarketplaceTransactionStatus,
  _role: OrderViewerRole
): ActionRequiredProjection {
  const transitions = getAllowedTransitions(status);
  if (transitions.length === 0) {
    return { actionRequiredBy: "none", nextActionKey: null };
  }

  const picked = pickNominalTransition(status, transitions);
  if (!picked) {
    return { actionRequiredBy: "none", nextActionKey: null };
  }

  const actionRequiredBy = actorFromTransition(picked);
  if (actionRequiredBy === "system") {
    return { actionRequiredBy: "system", nextActionKey: null };
  }

  return {
    actionRequiredBy,
    nextActionKey: EVENT_TO_ACTION_KEY[picked.event] ?? null
  };
}

const SHOP_ACTION_BY_STATUS: Readonly<
  Record<MerchantOrderStatus, ActionRequiredProjection>
> = {
  [MerchantOrderStatus.payment_pending]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.pay"
  },
  [MerchantOrderStatus.paid]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.confirmShopOrder"
  },
  [MerchantOrderStatus.confirmed]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.shipShopOrder"
  },
  [MerchantOrderStatus.shipping]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.markShopDelivered"
  },
  [MerchantOrderStatus.delivered]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.confirmReceipt"
  },
  [MerchantOrderStatus.completed]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MerchantOrderStatus.rejected]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MerchantOrderStatus.auto_rejected]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MerchantOrderStatus.refunded]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MerchantOrderStatus.disputed]: {
    actionRequiredBy: "system",
    nextActionKey: null
  },
  [MerchantOrderStatus.cancelled]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MerchantOrderStatus.failed]: {
    actionRequiredBy: "none",
    nextActionKey: null
  }
};

/** Action requise pour une commande boutique (hors machine escrow). */
export function deriveShopActionRequired(
  status: MerchantOrderStatus,
  _role: OrderViewerRole
): ActionRequiredProjection {
  return SHOP_ACTION_BY_STATUS[status];
}
