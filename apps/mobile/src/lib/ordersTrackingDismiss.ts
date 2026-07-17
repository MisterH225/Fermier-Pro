import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "ordersTracking.dismissed.v1";

function storageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId}`;
}

/** Lit les IDs de commandes masquées du dashboard pour ce profil/utilisateur. */
export async function loadDismissedOrderIds(
  scopeId: string
): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scopeId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Persiste le masquage d’une carte de suivi (swipe). */
export async function dismissOrderTrackingCard(
  scopeId: string,
  orderId: string
): Promise<Set<string>> {
  const next = await loadDismissedOrderIds(scopeId);
  next.add(orderId);
  await AsyncStorage.setItem(
    storageKey(scopeId),
    JSON.stringify([...next])
  );
  return next;
}

/**
 * Retire les IDs qui ne sont plus dans la liste active — évite d’accumuler
 * des dismiss éternels après clôture des commandes.
 */
export async function pruneDismissedOrderIds(
  scopeId: string,
  activeOrderIds: readonly string[]
): Promise<Set<string>> {
  const current = await loadDismissedOrderIds(scopeId);
  if (current.size === 0) return current;
  const active = new Set(activeOrderIds);
  const next = new Set([...current].filter((id) => active.has(id)));
  if (next.size !== current.size) {
    await AsyncStorage.setItem(
      storageKey(scopeId),
      JSON.stringify([...next])
    );
  }
  return next;
}
