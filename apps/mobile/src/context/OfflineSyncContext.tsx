import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { onlineManager } from "@tanstack/react-query";
import { loadOfflineQueue, saveOfflineQueue } from "../lib/offline/queueStore";
import {
  resetQueueItemForRetry,
  syncOfflineQueue
} from "../lib/offline/syncEngine";
import type { OfflineQueueItem } from "../lib/offline/types";
import {
  OFFLINE_MAX_RETRIES,
  createIdempotencyKey
} from "../lib/offline/types";
import { useSession } from "./SessionContext";

type OfflineSyncContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  queue: OfflineQueueItem[];
  enqueue: (
    item: Omit<
      OfflineQueueItem,
      "id" | "createdAt" | "status" | "retryCount" | "idempotencyKey"
    > & {
      id?: string;
      idempotencyKey?: string;
    }
  ) => Promise<string>;
  syncNow: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  pruneSynced: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function createOfflineQueueId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function newQueueId(): string {
  return createOfflineQueueId();
}

/** Migre les items persistés avant l’ajout de `idempotencyKey`. */
function normalizeQueueItem(raw: OfflineQueueItem): OfflineQueueItem {
  return {
    ...raw,
    idempotencyKey: raw.idempotencyKey || createIdempotencyKey(),
    status: raw.status === "syncing" ? "pending" : raw.status,
    retryCount: raw.retryCount ?? 0
  };
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const pruneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadOfflineQueue().then((items) => {
      setQueue(items.map(normalizeQueueItem));
    });
  }, []);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      onlineManager.setOnline(online);
    });
    return () => sub();
  }, []);

  useEffect(() => {
    return () => {
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
      }
    };
  }, []);

  const persistQueue = useCallback(async (items: OfflineQueueItem[]) => {
    setQueue(items);
    await saveOfflineQueue(items);
  }, []);

  const enqueue = useCallback(
    async (
      draft: Omit<
        OfflineQueueItem,
        "id" | "createdAt" | "status" | "retryCount" | "idempotencyKey"
      > & {
        id?: string;
        idempotencyKey?: string;
      }
    ): Promise<string> => {
      const id = draft.id ?? newQueueId();
      const item: OfflineQueueItem = {
        ...draft,
        id,
        idempotencyKey: draft.idempotencyKey ?? createIdempotencyKey(),
        createdAt: Date.now(),
        status: "pending",
        retryCount: 0
      };
      let next: OfflineQueueItem[] = [];
      setQueue((prev) => {
        next = [...prev, item];
        return next;
      });
      await saveOfflineQueue(next);
      return id;
    },
    []
  );

  const pruneSynced = useCallback(async () => {
    setQueue((prev) => {
      const next = prev.filter((i) => i.status !== "synced");
      void saveOfflineQueue(next);
      return next;
    });
  }, []);

  const syncNow = useCallback(async () => {
    if (!accessToken || syncingRef.current || queue.length === 0) {
      return;
    }
    if (!onlineManager.isOnline()) {
      return;
    }
    const hasWork = queue.some(
      (i) =>
        i.status === "pending" ||
        i.status === "syncing" ||
        (i.status === "failed" && i.retryCount < OFFLINE_MAX_RETRIES)
    );
    if (!hasWork) {
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const remaining = await syncOfflineQueue({
        items: queue,
        accessToken,
        activeProfileId,
        queryClient
      });
      await persistQueue(remaining);
      if (pruneTimerRef.current) {
        clearTimeout(pruneTimerRef.current);
      }
      pruneTimerRef.current = setTimeout(() => {
        void pruneSynced();
      }, 8000);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [
    accessToken,
    activeProfileId,
    queue,
    queryClient,
    persistQueue,
    pruneSynced
  ]);

  useEffect(() => {
    if (isOnline && queue.length > 0 && accessToken) {
      void syncNow();
    }
  }, [isOnline, queue.length, accessToken, syncNow]);

  const retryItem = useCallback(
    async (id: string) => {
      let next: OfflineQueueItem[] = [];
      setQueue((prev) => {
        next = prev.map((i) =>
          i.id === id ? resetQueueItemForRetry(i) : i
        );
        return next;
      });
      await saveOfflineQueue(next);
      if (onlineManager.isOnline() && accessToken) {
        // syncNow lira le state React — forcer via la file persistée
        syncingRef.current = false;
        const remaining = await syncOfflineQueue({
          items: next,
          accessToken,
          activeProfileId,
          queryClient
        });
        await persistQueue(remaining);
      }
    },
    [accessToken, activeProfileId, queryClient, persistQueue]
  );

  const pendingCount = queue.filter(
    (i) =>
      i.status === "pending" ||
      i.status === "syncing" ||
      (i.status === "failed" && i.retryCount < OFFLINE_MAX_RETRIES)
  ).length;
  const failedCount = queue.filter(
    (i) => i.status === "failed" && i.retryCount >= OFFLINE_MAX_RETRIES
  ).length;

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      failedCount,
      queue,
      enqueue,
      syncNow,
      retryItem,
      pruneSynced
    }),
    [
      isOnline,
      isSyncing,
      pendingCount,
      failedCount,
      queue,
      enqueue,
      syncNow,
      retryItem,
      pruneSynced
    ]
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync doit être utilisé dans OfflineSyncProvider");
  }
  return ctx;
}
