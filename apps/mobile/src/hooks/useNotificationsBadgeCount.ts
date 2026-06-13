import { useQuery } from "@tanstack/react-query";
import { fetchFarmSmartAlertsCount, fetchMyAdminMessagesUnreadCount } from "../lib/api";
import { useSession } from "../context/SessionContext";

/** Badge unifié : messages admin non lus + alertes critiques ferme (si applicable). */
export function useNotificationsBadgeCount(farmId?: string | null) {
  const { accessToken, activeProfileId } = useSession();

  const adminQ = useQuery({
    queryKey: ["auth.me.adminMessages.unreadCount"],
    queryFn: () => fetchMyAdminMessagesUnreadCount(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const farmQ = useQuery({
    queryKey: ["smartAlerts", farmId, activeProfileId, "count"],
    queryFn: () => fetchFarmSmartAlertsCount(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  return (adminQ.data?.count ?? 0) + (farmQ.data?.criticalUnread ?? 0);
}
