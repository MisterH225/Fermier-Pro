/** Appel HTTP sérialisable pour la file offline. */
export type OfflineApiCall = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
};

export type OfflineQueueItemStatus = "pending" | "syncing" | "failed";

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
