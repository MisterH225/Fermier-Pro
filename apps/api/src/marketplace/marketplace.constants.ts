/**
 * Constantes marketplace partagées (sans dépendance de service, pour éviter
 * les cycles d'import).
 */

/** Durée de vie d'une offre non traitée avant expiration (cron quotidien). */
export const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
