import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

/** Clé AsyncStorage pour le cache TanStack persistant (logout = suppression). */
export const QUERY_PERSIST_STORAGE_KEY = "@fermier_pro/tanstack_offline";

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_PERSIST_STORAGE_KEY,
  throttleTime: 1000
});

/** Lecture seule métier : derniers GET conservés pour consultation hors réseau. */
const PERSIST_QUERY_ROOTS = new Set([
  "farms",
  "farm",
  "farmAnimals",
  "farmBatches",
  "farmAnimal",
  "farmBatch",
  "farmTasks",
  "batchHealthEvents",
  "marketplaceListings",
  "marketplaceListing",
  "marketplaceMyOffers",
  "marketplaceMyListings",
  "chatRooms",
  "chatMessages"
]);

export function shouldPersistQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return (
    typeof root === "string" &&
    PERSIST_QUERY_ROOTS.has(root) &&
    query.state.status === "success"
  );
}
