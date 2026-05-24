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
import { syncOfflineQueue } from "../lib/offline/syncEngine";
import type { OfflineQueueItem } from "../lib/offline/types";
import { useSession } from "./SessionContext";

type OfflineSyncContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  queue: OfflineQueueItem[];
  enqueue: (
    item: Omit<OfflineQueueItem, "id" | "createdAt" | "status" | "retryCount"> & {
      id?: string;
    }
  ) => Promise<string>;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function createOfflineQueueId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function newQueueId(): string {
  return createOfflineQueueId();
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    void loadOfflineQueue().then(setQueue);
  }, []);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      onlineManager.setOnline(online);
    });
    return () => sub();
  }, []);

  const persistQueue = useCallback(async (items: OfflineQueueItem[]) => {
    setQueue(items);
    await saveOfflineQueue(items);
  }, []);

  const enqueue = useCallback(
    async (
      draft: Omit<OfflineQueueItem, "id" | "createdAt" | "status" | "retryCount"> & {
        id?: string;
      }
    ): Promise<string> => {
      const id = draft.id ?? newQueueId();
      const item: OfflineQueueItem = {
        ...draft,
        id,
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

  const syncNow = useCallback(async () => {
    if (!accessToken || syncingRef.current || queue.length === 0) {
      return;
    }
    if (!onlineManager.isOnline()) {
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
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [accessToken, activeProfileId, queue, queryClient, persistQueue]);

  useEffect(() => {
    if (isOnline && queue.length > 0 && accessToken) {
      void syncNow();
    }
  }, [isOnline, queue.length, accessToken, syncNow]);

  const pendingCount = queue.filter((i) => i.status !== "failed").length;
  const failedCount = queue.filter((i) => i.status === "failed").length;

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      failedCount,
      queue,
      enqueue,
      syncNow
    }),
    [
      isOnline,
      isSyncing,
      pendingCount,
      failedCount,
      queue,
      enqueue,
      syncNow
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
