import { useCallback, useEffect, useState } from "react";

/**
 * Pagination locale (slice) pour données déjà chargées côté parent.
 * Utile si tu affiches une liste hors `EventList` ou pour logique métier custom.
 */
export function useEventListSlice<T>(items: T[], pageSize = 20) {
  const [limit, setLimit] = useState(pageSize);

  useEffect(() => {
    setLimit(pageSize);
  }, [items, pageSize]);

  const visible = items.slice(0, limit);
  const hasMore = limit < items.length;

  const loadMore = useCallback(() => {
    setLimit((n) => Math.min(n + pageSize, items.length));
  }, [items.length, pageSize]);

  const reset = useCallback(() => {
    setLimit(pageSize);
  }, [pageSize]);

  return { visible, hasMore, loadMore, reset };
}
