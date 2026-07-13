import type { QueryClient } from "@tanstack/react-query";
import { getSupabase } from "../supabase";
import { uploadFinanceProofToSupabase } from "../uploadFinanceProofToSupabase";
import { executeOfflineApiCall } from "./executeCall";
import { isNetworkError } from "./network";
import { loadIdMappings, saveIdMappings } from "./queueStore";
import { resolveOfflineValue } from "./resolveTemplates";
import type { OfflineIdMappings, OfflineQueueItem } from "./types";
import {
  OFFLINE_MAX_RETRIES,
  attachIdempotencyHeaders,
  offlineLocalId
} from "./types";

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
    const calls = attachIdempotencyHeaders(
      work.calls,
      work.idempotencyKey || item.id
    );

    for (const call of calls) {
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
      item: { ...syncing, status: "synced", lastError: undefined },
      idMappings: nextMappings
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = isNetworkError(e);
    const retryCount = item.retryCount + 1;
    return {
      ok: false,
      item: {
        ...syncing,
        status: "failed",
        lastError: msg,
        retryCount
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

/**
 * Rejoue la file dans l’ordre FIFO.
 * - succès → `synced`
 * - erreur réseau → stop (conserve l’ordre), incrémente `retryCount`
 * - erreur métier ou ≥ OFFLINE_MAX_RETRIES → `failed` permanent, passe au suivant
 */
export async function syncOfflineQueue(options: {
  items: OfflineQueueItem[];
  accessToken: string;
  activeProfileId?: string | null;
  queryClient: QueryClient;
  onProgress?: (remaining: number) => void;
}): Promise<OfflineQueueItem[]> {
  const { accessToken, activeProfileId, queryClient, onProgress } = options;
  const items = options.items.map((i) => ({ ...i }));
  let idMappings = await loadIdMappings();
  let index = 0;

  while (index < items.length) {
    const head = items[index]!;
    if (head.status === "synced") {
      index += 1;
      continue;
    }
    if (head.status === "failed" && head.retryCount >= OFFLINE_MAX_RETRIES) {
      index += 1;
      continue;
    }

    const result = await syncOneQueueItem(
      head,
      accessToken,
      activeProfileId,
      idMappings
    );

    if (result.ok) {
      idMappings = result.idMappings;
      items[index] = result.item;
      invalidateAfterSync(queryClient, head.farmId, head.invalidateRoots);
      index += 1;
      onProgress?.(items.filter((i) => i.status === "pending" || i.status === "syncing").length);
      continue;
    }

    items[index] = result.item;

    if (!result.retryable) {
      // Erreur métier : échec définitif immédiat.
      items[index] = {
        ...result.item,
        status: "failed",
        retryCount: OFFLINE_MAX_RETRIES
      };
      index += 1;
      onProgress?.(items.filter((i) => i.status === "pending" || i.status === "syncing").length);
      continue;
    }

    if (result.item.retryCount >= OFFLINE_MAX_RETRIES) {
      index += 1;
      onProgress?.(items.filter((i) => i.status === "pending" || i.status === "syncing").length);
      continue;
    }

    // Réseau : stop pour préserver l’ordre au prochain retour réseau.
    break;
  }

  return items;
}

/** Remet un item en file pour un nouvel essai (bouton Réessayer). */
export function resetQueueItemForRetry(item: OfflineQueueItem): OfflineQueueItem {
  return {
    ...item,
    status: "pending",
    retryCount: 0,
    lastError: undefined
  };
}
