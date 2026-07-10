import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchMyUserNotifications } from "../lib/api";
import { useSession } from "../context/SessionContext";

export function useUserNotificationsInbox(enabled = true) {
  const { accessToken } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["auth.me.userNotifications"],
    queryFn: () => fetchMyUserNotifications(accessToken!),
    enabled: Boolean(enabled && accessToken),
    refetchOnWindowFocus: true
  });

  const markRead = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const { markMyUserNotificationRead } = await import("../lib/api");
      try {
        await markMyUserNotificationRead(accessToken, id);
        await qc.invalidateQueries({ queryKey: ["auth.me.userNotifications"] });
        await qc.invalidateQueries({
          queryKey: ["auth.me.userNotifications.unreadCount"]
        });
      } catch {
        // best effort
      }
    },
    [accessToken, qc]
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const { deleteMyUserNotification } = await import("../lib/api");
      try {
        await deleteMyUserNotification(accessToken, id);
        await qc.invalidateQueries({ queryKey: ["auth.me.userNotifications"] });
        await qc.invalidateQueries({
          queryKey: ["auth.me.userNotifications.unreadCount"]
        });
      } catch {
        // best effort
      }
    },
    [accessToken, qc]
  );

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    markRead,
    deleteNotification
  };
}
