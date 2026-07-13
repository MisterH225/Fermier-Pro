import { MarketplaceTransactionStatus } from "@prisma/client";
import {
  ACTIVE_ESCROW_STATUSES,
  CANCELLABLE_BY_BUYER,
  CANCELLABLE_BY_SELLER
} from "./transaction.utils";

/**
 * Événements de transition dérivés de marketplace-transaction.service.ts.
 * Un événement = un déclencheur métier distinct (pas un simple alias de statut cible).
 */
export const MARKETPLACE_TRANSACTION_EVENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "PAYMENT_RETRY",
  "PICKUP_PROPOSED",
  "PICKUP_CONFIRMED",
  "WEIGHT_DECLARED",
  "WEIGHT_COUNTER_DECLARED",
  "WEIGHT_VALIDATED_BY_SELLER",
  "WEIGHT_AUTO_VALIDATED",
  "WEIGHT_ARBITRATION_REQUESTED",
  "WEIGHT_ARBITRATED",
  "SELLER_SHIPPED",
  "BUYER_RECEIVED",
  "DELIVERY_DISPUTED",
  "DELIVERY_DISPUTE_AUTO",
  "DELIVERY_DISPUTE_VENDOR_WIN",
  "DELIVERY_DISPUTE_BUYER_WIN",
  "DELIVERY_DISPUTE_CANCELLED",
  "DELIVERY_DISPUTE_SPLIT",
  "TRANSACTION_SETTLED",
  "CREDIT_TRANSACTION_SETTLED",
  "BUYER_CANCEL",
  "SELLER_CANCEL",
  "OFFER_EXPIRED",
  "CANCELLED_SOLD_TO_OTHER"
] as const;

export type MarketplaceTransactionEvent =
  (typeof MARKETPLACE_TRANSACTION_EVENTS)[number];

/** Acteurs pouvant déclencher l'événement (documentation + audit). */
export type MarketplaceTransactionActor =
  | "buyer"
  | "seller"
  | "webhook"
  | "cron"
  | "admin"
  | "system";

export interface TransitionDefinition {
  from: MarketplaceTransactionStatus;
  event: MarketplaceTransactionEvent;
  to: MarketplaceTransactionStatus;
  /** Qui peut déclencher cette transition dans le code actuel. */
  actors: readonly MarketplaceTransactionActor[];
}

export interface TransitionResult {
  allowed: boolean;
  to: MarketplaceTransactionStatus | null;
}

/**
 * Table des transitions autorisées — miroir fidèle du service escrow.
 * Pas de création initiale (create → PAYMENT_PENDING) : ce n'est pas une
 * transition depuis un statut existant. OFFER_ACCEPTED n'apparaît nulle part
 * (statut présent dans l'enum Prisma mais jamais écrit par le service).
 */
export const TRANSACTION_TRANSITIONS: readonly TransitionDefinition[] = [
  // Paiement
  {
    from: MarketplaceTransactionStatus.PAYMENT_PENDING,
    event: "PAYMENT_CONFIRMED",
    to: MarketplaceTransactionStatus.PAYMENT_HELD,
    actors: ["buyer", "webhook"]
  },
  {
    from: MarketplaceTransactionStatus.PAYMENT_PENDING,
    event: "PAYMENT_FAILED",
    to: MarketplaceTransactionStatus.PAYMENT_FAILED,
    actors: ["buyer", "webhook"]
  },
  {
    from: MarketplaceTransactionStatus.PAYMENT_FAILED,
    event: "PAYMENT_RETRY",
    to: MarketplaceTransactionStatus.PAYMENT_PENDING,
    actors: ["buyer"]
  },
  {
    from: MarketplaceTransactionStatus.PAYMENT_PENDING,
    event: "OFFER_EXPIRED",
    to: MarketplaceTransactionStatus.OFFER_EXPIRED,
    actors: ["cron"]
  },

  // Rendez-vous / poids
  {
    from: MarketplaceTransactionStatus.PAYMENT_HELD,
    event: "PICKUP_PROPOSED",
    to: MarketplaceTransactionStatus.PICKUP_PROPOSED,
    actors: ["buyer"]
  },
  {
    from: MarketplaceTransactionStatus.PICKUP_PROPOSED,
    event: "PICKUP_CONFIRMED",
    to: MarketplaceTransactionStatus.PICKUP_SCHEDULED,
    actors: ["seller"]
  },
  {
    from: MarketplaceTransactionStatus.PICKUP_SCHEDULED,
    event: "WEIGHT_DECLARED",
    to: MarketplaceTransactionStatus.WEIGHT_DECLARED,
    actors: ["buyer"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_DECLARED,
    event: "WEIGHT_COUNTER_DECLARED",
    to: MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED,
    actors: ["seller"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_DECLARED,
    event: "WEIGHT_VALIDATED_BY_SELLER",
    to: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    actors: ["seller"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED,
    event: "WEIGHT_VALIDATED_BY_SELLER",
    to: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    actors: ["seller"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_DECLARED,
    event: "WEIGHT_AUTO_VALIDATED",
    to: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    actors: ["cron"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED,
    event: "WEIGHT_ARBITRATION_REQUESTED",
    to: MarketplaceTransactionStatus.WEIGHT_DISPUTED,
    actors: ["buyer", "seller"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_DISPUTED,
    event: "WEIGHT_ARBITRATED",
    to: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    actors: ["admin"]
  },

  // Expédition / réception / litige livraison
  {
    from: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    event: "SELLER_SHIPPED",
    to: MarketplaceTransactionStatus.SELLER_SHIPPED,
    actors: ["seller"]
  },
  {
    from: MarketplaceTransactionStatus.SELLER_SHIPPED,
    event: "BUYER_RECEIVED",
    to: MarketplaceTransactionStatus.BUYER_RECEIVED,
    actors: ["buyer"]
  },
  {
    from: MarketplaceTransactionStatus.SELLER_SHIPPED,
    event: "DELIVERY_DISPUTED",
    to: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    actors: ["buyer", "seller"]
  },
  {
    from: MarketplaceTransactionStatus.BUYER_RECEIVED,
    event: "DELIVERY_DISPUTED",
    to: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    actors: ["buyer", "seller"]
  },
  {
    from: MarketplaceTransactionStatus.SELLER_SHIPPED,
    event: "DELIVERY_DISPUTE_AUTO",
    to: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    actors: ["cron"]
  },
  {
    from: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    event: "DELIVERY_DISPUTE_VENDOR_WIN",
    to: MarketplaceTransactionStatus.BUYER_RECEIVED,
    actors: ["admin"]
  },
  {
    from: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    event: "DELIVERY_DISPUTE_BUYER_WIN",
    to: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
    actors: ["admin"]
  },
  {
    from: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    event: "DELIVERY_DISPUTE_CANCELLED",
    to: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
    actors: ["admin"]
  },
  {
    from: MarketplaceTransactionStatus.DELIVERY_DISPUTED,
    event: "DELIVERY_DISPUTE_SPLIT",
    to: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
    actors: ["admin"]
  },

  // Clôture
  {
    from: MarketplaceTransactionStatus.BUYER_RECEIVED,
    event: "TRANSACTION_SETTLED",
    to: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
    actors: ["system"]
  },
  {
    from: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
    event: "CREDIT_TRANSACTION_SETTLED",
    to: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
    actors: ["system"]
  },
  {
    from: MarketplaceTransactionStatus.BUYER_RECEIVED,
    event: "CREDIT_TRANSACTION_SETTLED",
    to: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
    actors: ["system"]
  },

  // Annulations acheteur / vendeur (listes CANCELLABLE_BY_*)
  ...CANCELLABLE_BY_BUYER.map(
    (from): TransitionDefinition => ({
      from,
      event: "BUYER_CANCEL",
      to: MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
      actors: ["buyer"]
    })
  ),
  ...CANCELLABLE_BY_SELLER.map(
    (from): TransitionDefinition => ({
      from,
      event: "SELLER_CANCEL",
      to: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
      actors: ["seller"]
    })
  ),

  // Autres acheteurs escrow actif après clôture gagnante
  ...ACTIVE_ESCROW_STATUSES.map(
    (from): TransitionDefinition => ({
      from,
      event: "CANCELLED_SOLD_TO_OTHER",
      to: MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
      actors: ["system"]
    })
  )
];

const TRANSITION_LOOKUP = new Map<string, MarketplaceTransactionStatus>();

for (const transition of TRANSACTION_TRANSITIONS) {
  const key = transitionKey(transition.from, transition.event);
  if (TRANSITION_LOOKUP.has(key)) {
    throw new Error(
      `Transition en double pour ${transition.from} + ${transition.event}`
    );
  }
  TRANSITION_LOOKUP.set(key, transition.to);
}

function transitionKey(
  from: MarketplaceTransactionStatus,
  event: MarketplaceTransactionEvent
): string {
  return `${from}::${event}`;
}

/**
 * Validation pure d'une transition de statut marketplace.
 * Ne remplace pas les updateMany conditionnels (garantie d'atomicité en base).
 */
export function canTransition(
  from: MarketplaceTransactionStatus,
  event: MarketplaceTransactionEvent
): TransitionResult {
  const to = TRANSITION_LOOKUP.get(transitionKey(from, event)) ?? null;
  return { allowed: to != null, to };
}

export function getAllowedTransitions(
  from: MarketplaceTransactionStatus
): readonly TransitionDefinition[] {
  return TRANSACTION_TRANSITIONS.filter((t) => t.from === from);
}
