import { useQuery } from "@tanstack/react-query";
import {
  fetchFarmSmartAlertsCount,
  fetchMyAdminMessagesUnreadCount,
  fetchMyUserNotificationsUnreadCount
} from "../lib/api";
import { useSession } from "../context/SessionContext";

/** Badge unifié : notifs user + messages admin + alertes critiques ferme. */
export function useNotificationsBadgeCount(farmId?: string | null) {
  const { accessToken, activeProfileId } = useSession();

  const userQ = useQuery({
    queryKey: ["auth.me.userNotifications.unreadCount"],
    queryFn: () => fetchMyUserNotificationsUnreadCount(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const adminQ = useQuery({
    queryKey: ["auth.me.adminMessages.unreadCount"],
    queryFn: () => fetchMyAdminMessagesUnreadCount(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const farmQ = useQuery({
    queryKey: ["smartAlerts", farmId, activeProfileId, "count"],
    queryFn: () =>
      fetchFarmSmartAlertsCount(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  return (
    (userQ.data?.count ?? 0) +
    (adminQ.data?.count ?? 0) +
    (farmQ.data?.criticalUnread ?? 0)
  );
}
