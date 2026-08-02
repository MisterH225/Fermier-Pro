/**
 * Fenêtre de litige courte après mise à disposition effective (P-J5).
 * Armée sur readyActual (retrait) ou deliveredAt (livraison) — jamais readyEstimate.
 * Alignée sur MERCHANT_ORDER_DISPUTE_WINDOW_MS (48 h).
 */
export const COMPOSITION_ORDER_DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;
