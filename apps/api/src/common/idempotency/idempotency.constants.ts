export const IDEMPOTENCY_HEADER = "x-idempotency-key";

/** TTL de conservation des réponses idempotentes (7 jours). */
export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const IDEMPOTENT_META = "idempotent";
