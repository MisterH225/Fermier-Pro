import { onlineManager, useMutation } from "@tanstack/react-query";
import {
  createOfflineQueueId,
  useOfflineSync
} from "../context/OfflineSyncContext";
import { isNetworkError } from "../lib/offline/network";
import type { OfflineQueueItem } from "../lib/offline/types";
import {
  attachIdempotencyHeaders,
  createIdempotencyKey,
  isOfflineQueuedResult,
  OFFLINE_QUEUED,
  offlineLocalId,
  type OfflineQueuedResult
} from "../lib/offline/types";

export type UseOfflineMutationConfig<TVariables> = {
  farmId: string;
  type: string;
  label: string;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  buildOfflineItem: (
    variables: TVariables
  ) => Pick<
    OfflineQueueItem,
    | "calls"
    | "invalidateRoots"
    | "localProofUri"
    | "proofMeta"
    | "localEntityId"
  >;
  applyOptimistic?: (variables: TVariables, queueItemId: string) => void;
  /** Associe `offline:<queueItemId>` au 1er enregistrement créé (animal, etc.). */
  assignLocalEntityId?: boolean;
  onSuccess?: (data: unknown, variables: TVariables) => void;
  onQueued?: (variables: TVariables, queueItemId: string) => void;
  onError?: (error: Error, variables: TVariables) => void;
};

export function useOfflineMutation<TVariables = void>(
  config: UseOfflineMutationConfig<TVariables>
) {
  const { enqueue, isOnline, syncNow } = useOfflineSync();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const tryOnline = isOnline && onlineManager.isOnline();
      if (tryOnline) {
        try {
          return await config.mutationFn(variables);
        } catch (e) {
          if (!isNetworkError(e)) {
            throw e;
          }
        }
      }

      const built = config.buildOfflineItem(variables);
      const queueItemId = createOfflineQueueId();
      const idempotencyKey = createIdempotencyKey();
      await enqueue({
        id: queueItemId,
        farmId: config.farmId,
        type: config.type,
        label: config.label,
        ...built,
        calls: attachIdempotencyHeaders(built.calls, idempotencyKey),
        idempotencyKey,
        localEntityId:
          built.localEntityId ??
          (config.assignLocalEntityId
            ? offlineLocalId(queueItemId)
            : undefined)
      });

      config.applyOptimistic?.(variables, queueItemId);

      const queued: OfflineQueuedResult = {
        [OFFLINE_QUEUED]: true,
        queueItemId
      };
      return queued;
    },
    onSuccess: (data, variables) => {
      if (data && typeof data === "object" && OFFLINE_QUEUED in data) {
        config.onQueued?.(variables, (data as OfflineQueuedResult).queueItemId);
        return;
      }
      config.onSuccess?.(data, variables);
      if (isOnline) {
        void syncNow();
      }
    },
    onError: (e: Error, variables) => {
      config.onError?.(e, variables);
    }
  });
}

export function offlineQueuedMessage(t: (key: string) => string): string {
  return t("offline.queuedSuccess");
}

/** Message de succès selon synchro immédiate ou file d’attente. */
export { isOfflineQueuedResult };

export function offlineAwareMessage(
  t: (key: string) => string,
  data: unknown,
  onlineMessageKey: string
): string {
  return isOfflineQueuedResult(data)
    ? offlineQueuedMessage(t)
    : t(onlineMessageKey);
}
