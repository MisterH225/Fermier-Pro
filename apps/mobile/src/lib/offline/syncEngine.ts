import type { QueryClient } from "@tanstack/react-query";
import { getSupabase } from "../supabase";
import { uploadFinanceProofToSupabase } from "../uploadFinanceProofToSupabase";
import { executeOfflineApiCall } from "./executeCall";
import { isNetworkError } from "./network";
import { loadIdMappings, saveIdMappings } from "./queueStore";
import { resolveOfflineValue } from "./resolveTemplates";
import type { OfflineIdMappings, OfflineQueueItem } from "./types";
import { offlineLocalId } from "./types";

export type SyncOneItemResult =
  | { ok: true; item: OfflineQueueItem; idMappings: OfflineIdMappings }
  | { ok: false; item: OfflineQueueItem; retryable: boolean };

async function uploadProofIfNeeded(
  item: OfflineQueueItem,
  accessToken: string
): Promise<OfflineQueueItem> {
  if (!item.localProofUri || !item.proofMeta) {
    return item;
  }
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase non configuré pour l’upload du justificatif");
  }
  const attachmentUrl = await uploadFinanceProofToSupabase(
    supabase,
    item.proofMeta.farmId,
    item.proofMeta.txRef,
    item.localProofUri,
    item.proofMeta.mime
  );
  const calls = item.calls.map((c, i) => {
    if (i !== item.calls.length - 1 || c.method !== "POST") {
      return c;
    }
    const body =
      c.body && typeof c.body === "object"
        ? { ...(c.body as Record<string, unknown>), attachmentUrl }
        : { attachmentUrl };
    return { ...c, body };
  });
  return { ...item, calls, localProofUri: undefined };
}

export async function syncOneQueueItem(
  item: OfflineQueueItem,
  accessToken: string,
  activeProfileId: string | null | undefined,
  idMappings: OfflineIdMappings
): Promise<SyncOneItemResult> {
  const syncing: OfflineQueueItem = {
    ...item,
    status: "syncing",
    lastError: undefined
  };
  try {
    let work = await uploadProofIfNeeded(item, accessToken);
    const results: unknown[] = [];
    const nextMappings = { ...idMappings };

    for (const call of work.calls) {
      const path = resolveOfflineValue(call.path, results, nextMappings) as string;
      const body = resolveOfflineValue(call.body, results, nextMappings);
      const res = await executeOfflineApiCall(
        { ...call, path, body },
        accessToken,
        activeProfileId
      );
      results.push(res);
    }

    if (work.localEntityId) {
      const first = results[0] as { id?: string } | undefined;
      if (first?.id) {
        nextMappings[work.localEntityId] = first.id;
        nextMappings[offlineLocalId(work.id)] = first.id;
      }
    }

    await saveIdMappings(nextMappings);

    return {
      ok: true,
      item: { ...syncing, status: "pending" },
      idMappings: nextMappings
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = isNetworkError(e);
    return {
      ok: false,
      item: {
        ...syncing,
        status: "failed",
        lastError: msg,
        retryCount: item.retryCount + 1
      },
      retryable
    };
  }
}

export function invalidateAfterSync(
  qc: QueryClient,
  farmId: string,
  roots: string[]
): void {
  for (const root of roots) {
    void qc.invalidateQueries({ queryKey: [root, farmId] });
  }
}

export async function syncOfflineQueue(options: {
  items: OfflineQueueItem[];
  accessToken: string;
  activeProfileId?: string | null;
  queryClient: QueryClient;
  onProgress?: (remaining: number) => void;
}): Promise<OfflineQueueItem[]> {
  const { accessToken, activeProfileId, queryClient, onProgress } = options;
  let remaining = [...options.items];
  let idMappings = await loadIdMappings();

  while (remaining.length > 0) {
    const head = remaining[0]!;
    if (head.status === "failed" && head.retryCount > 5) {
      break;
    }
    const result = await syncOneQueueItem(
      head,
      accessToken,
      activeProfileId,
      idMappings
    );
    if (result.ok) {
      idMappings = result.idMappings;
      invalidateAfterSync(queryClient, head.farmId, head.invalidateRoots);
      remaining = remaining.slice(1);
    } else {
      remaining = [result.item, ...remaining.slice(1)];
      if (result.retryable) {
        break;
      }
      remaining = remaining.slice(1);
    }
    onProgress?.(remaining.length);
  }

  return remaining;
}
