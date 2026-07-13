/** Appel HTTP sérialisable pour la file offline. */
export type OfflineApiCall = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type OfflineQueueItemStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed";

/** Tentatives max avant échec définitif. */
export const OFFLINE_MAX_RETRIES = 5;

export const IDEMPOTENCY_HEADER = "X-Idempotency-Key";

/**
 * Types de mutations terrain couverts par la file offline critique.
 * (pesées, santé/mortalités, mises bas, finances, pesée bande)
 */
export const CRITICAL_OFFLINE_MUTATION_TYPES = [
  "cheptel.postWeight",
  "cheptel.postBatchWeight",
  "health.createRecord",
  "gestation.recordLitter",
  "finance.postTransaction"
] as const;

export type CriticalOfflineMutationType =
  (typeof CRITICAL_OFFLINE_MUTATION_TYPES)[number];

/**
 * Action métier mise en file. `calls` sont exécutés dans l'ordre ;
 * les chemins/corps peuvent référencer `{{0.id}}` (résultat du 1er appel), etc.
 */
export type OfflineQueueItem = {
  id: string;
  farmId: string;
  type: string;
  label: string;
  calls: OfflineApiCall[];
  invalidateRoots: string[];
  createdAt: number;
  status: OfflineQueueItemStatus;
  retryCount: number;
  lastError?: string;
  /** UUID généré à la mise en file → header X-Idempotency-Key au rejeu. */
  idempotencyKey: string;
  /** URI locale (justificatif finance) à uploader avant le POST. */
  localProofUri?: string;
  proofMeta?: { farmId: string; txRef: string; mime: string };
  /** ID local `offline:<queueItemId>` exposé aux écrans / mutations suivantes. */
  localEntityId?: string;
};

export type OfflineIdMappings = Record<string, string>;

export const OFFLINE_QUEUE_STORAGE_KEY = "@fermier_pro/offline_queue";
export const OFFLINE_ID_MAP_STORAGE_KEY = "@fermier_pro/offline_id_map";

export const OFFLINE_QUEUED = Symbol("OFFLINE_QUEUED");

export type OfflineQueuedResult = { [OFFLINE_QUEUED]: true; queueItemId: string };

export function isOfflineQueuedResult(
  value: unknown
): value is OfflineQueuedResult {
  return (
    typeof value === "object" &&
    value !== null &&
    OFFLINE_QUEUED in value &&
    (value as OfflineQueuedResult)[OFFLINE_QUEUED] === true
  );
}

export function offlineLocalId(queueItemId: string): string {
  return `offline:${queueItemId}`;
}

/** UUID v4 pour clé d’idempotence (file offline). */
export function createIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function isPermanentFailure(item: OfflineQueueItem): boolean {
  return item.status === "failed" && item.retryCount >= OFFLINE_MAX_RETRIES;
}

export function attachIdempotencyHeaders(
  calls: OfflineApiCall[],
  idempotencyKey: string
): OfflineApiCall[] {
  return calls.map((call, index) => ({
    ...call,
    headers: {
      ...call.headers,
      [IDEMPOTENCY_HEADER]:
        calls.length > 1 ? `${idempotencyKey}:${index}` : idempotencyKey
    }
  }));
}
