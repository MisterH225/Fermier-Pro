import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchMyAdminMessages } from "../lib/api";
import { useSession } from "../context/SessionContext";

export function useAdminMessagesInbox(enabled = true) {
  const { accessToken } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["auth.me.adminMessages"],
    queryFn: () => fetchMyAdminMessages(accessToken!),
    enabled: Boolean(enabled && accessToken),
    refetchOnWindowFocus: true
  });

  const markRead = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const { markMyAdminMessageRead } = await import("../lib/api");
      try {
        await markMyAdminMessageRead(accessToken, id);
        await qc.invalidateQueries({ queryKey: ["auth.me.adminMessages"] });
        await qc.invalidateQueries({
          queryKey: ["auth.me.adminMessages.unreadCount"]
        });
      } catch {
        // best effort
      }
    },
    [accessToken, qc]
  );

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    markRead,
    refetch: query.refetch
  };
}
