export const MERCHANT_FREE_MAX_SHOPS = 1;
export const MERCHANT_FREE_MAX_ACTIVE_PRODUCTS = 5;

/** Délai d'acceptation commerçant après paiement (24h). */
export const MERCHANT_ORDER_CONFIRM_TIMEOUT_MS = 24 * 60 * 60 * 1000;
/** Fenêtre litige après livraison (48h). */
export const MERCHANT_ORDER_DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

export const MERCHANT_ERROR = {
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  ACTIVE_PRODUCT_LIMIT: "ACTIVE_PRODUCT_LIMIT",
  SHOP_LIMIT: "SHOP_LIMIT",
  STOCK_UNAVAILABLE: "STOCK_UNAVAILABLE",
  CATEGORY_INACTIVE: "CATEGORY_INACTIVE",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  /** Archivage refusé : commandes boutique encore en cours. */
  SHOP_HAS_ACTIVE_ORDERS: "SHOP_HAS_ACTIVE_ORDERS",
  /** Hard delete refusé : historique de commandes présent. */
  SHOP_HAS_ORDER_HISTORY: "SHOP_HAS_ORDER_HISTORY",
  SHOP_ALREADY_ARCHIVED: "SHOP_ALREADY_ARCHIVED",
  /** Suppression produit refusée : commandes encore en cours. */
  PRODUCT_HAS_ACTIVE_ORDERS: "PRODUCT_HAS_ACTIVE_ORDERS",
  /** Trop de re-soumissions après modération — contacter le support. */
  RESUBMISSION_LIMIT: "RESUBMISSION_LIMIT",
  RESUBMISSION_INVALID_STATUS: "RESUBMISSION_INVALID_STATUS",
  /** Clawback litige post-completed : solde vendeur insuffisant. */
  SELLER_BALANCE_INSUFFICIENT: "SELLER_BALANCE_INSUFFICIENT"
} as const;

/** Nombre max de re-soumissions après un retrait modération. */
export const MERCHANT_PRODUCT_MAX_RESUBMISSIONS = 2;

/**
 * Statuts qui bloquent l’archivage d’une boutique
 * (commandes non clôturées ou litige ouvert).
 */
export const MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES = [
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "disputed"
] as const;
