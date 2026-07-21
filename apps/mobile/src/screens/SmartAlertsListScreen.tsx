import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text
} from "react-native";
import { useBottomInset } from "../hooks/useBottomInset";
import { MobileAppShell } from "../components/layout";
import { AdminMessageCard } from "../components/admin/AdminMessageCard";
import { UserNotificationCard } from "../components/notifications/UserNotificationCard";
import { AlertCard } from "../components/smartAlerts/AlertCard";
import { useAdminMessagesInbox } from "../hooks/useAdminMessagesInbox";
import { useUserNotificationsInbox } from "../hooks/useUserNotificationsInbox";
import { useSession } from "../context/SessionContext";
import {
  deleteFarmSmartAlert,
  fetchFarmSmartAlerts,
  patchFarmSmartAlertRead,
  postFarmSmartAlertsRefresh,
  type AdminMessageDto,
  type SmartAlertListItemDto,
  type UserNotificationDto
} from "../lib/api";
import { navigateFromGenericPushData } from "../services/navigation/DeepNavigationService";
import { sortSmartAlerts } from "../services/smartAlerts/SmartAlertsEngine";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SmartAlertsList">;

type ListRow =
  | { kind: "user"; id: string; notification: UserNotificationDto }
  | { kind: "admin"; id: string; message: AdminMessageDto }
  | { kind: "alert"; id: string; alert: SmartAlertListItemDto };

export function SmartAlertsListScreen({ route, navigation }: Props) {
  const farmId = route.params.farmId;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("navigation.screenTitles.notifications"));
  const { accessToken, activeProfileId } = useSession();
  const bottomInset = useBottomInset();
  const qc = useQueryClient();
  const {
    items: adminMessages,
    isLoading: adminLoading,
    markRead: markAdminRead,
    deleteMessage: deleteAdminMessage,
    refetch: refetchAdmin
  } = useAdminMessagesInbox();
  const {
    items: userNotifications,
    isLoading: userLoading,
    markRead: markUserRead,
    deleteNotification: deleteUserNotification,
    refetch: refetchUser
  } = useUserNotificationsInbox();

  const listQuery = useQuery({
    queryKey: ["smartAlerts", farmId, activeProfileId, "full"],
    queryFn: () =>
      fetchFarmSmartAlerts(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      postFarmSmartAlertsRefresh(accessToken!, farmId!, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
    }
  });

  const readMutation = useMutation({
    mutationFn: (alertId: string) =>
      patchFarmSmartAlertRead(
        accessToken!,
        farmId!,
        alertId,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      deleteFarmSmartAlert(accessToken!, farmId!, alertId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
    }
  });

  const confirmDelete = useCallback(
    (onConfirm: () => void) => {
      Alert.alert(
        t("smartAlerts.deleteConfirmTitle"),
        t("smartAlerts.deleteConfirmBody"),
        [
          { text: t("common.cancel", "Annuler"), style: "cancel" },
          {
            text: t("smartAlerts.delete"),
            style: "destructive",
            onPress: onConfirm
          }
        ]
      );
    },
    [t]
  );

  const onMarkAlertRead = useCallback(
    (id: string) => {
      readMutation.mutate(id);
    },
    [readMutation]
  );

  const onDeleteAdmin = useCallback(
    (id: string) => {
      confirmDelete(() => void deleteAdminMessage(id));
    },
    [confirmDelete, deleteAdminMessage]
  );

  const onDeleteUser = useCallback(
    (id: string) => {
      confirmDelete(() => void deleteUserNotification(id));
    },
    [confirmDelete, deleteUserNotification]
  );

  const onDeleteAlert = useCallback(
    (id: string) => {
      if (!farmId) {
        return;
      }
      confirmDelete(() => deleteAlertMutation.mutate(id));
    },
    [confirmDelete, deleteAlertMutation, farmId]
  );

  const onUserNotificationPress = useCallback(
    (notification: UserNotificationDto) => {
      if (!notification.isRead) {
        void markUserRead(notification.id);
      }
      const orderId =
        typeof notification.data?.orderId === "string"
          ? notification.data.orderId
          : notification.data?.orderId != null
            ? String(notification.data.orderId)
            : "";
      if (notification.type.startsWith("merchant_order") && orderId) {
        navigation.navigate("MerchantOrderDetail", { orderId });
        return;
      }
      navigateFromGenericPushData(navigation, {
        type: notification.type,
        ...Object.fromEntries(
          Object.entries(notification.data ?? {}).map(([k, v]) => [
            k,
            v == null ? "" : String(v)
          ])
        )
      });
    },
    [markUserRead, navigation]
  );

  const rows = useMemo((): ListRow[] => {
    const userRows: ListRow[] = userNotifications.map((n) => ({
      kind: "user" as const,
      id: `user-${n.id}`,
      notification: n
    }));
    const adminRows: ListRow[] = adminMessages.map((m) => ({
      kind: "admin" as const,
      id: `admin-${m.id}`,
      message: m
    }));
    // Les rappels dépenses inactives sont déjà poussés en UserNotification (évite le doublon).
    const alertRows: ListRow[] = sortSmartAlerts(listQuery.data?.items ?? [])
      .filter(
        (a) => !(a.ruleKey ?? "").startsWith("finance-expense-inactive:")
      )
      .map((a) => ({
        kind: "alert" as const,
        id: a.id,
        alert: a
      }));
    return [...userRows, ...adminRows, ...alertRows];
  }, [adminMessages, listQuery.data?.items, userNotifications]);

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.kind === "user") {
        return (
          <UserNotificationCard
            notification={item.notification}
            onPress={onUserNotificationPress}
            onDelete={onDeleteUser}
          />
        );
      }
      if (item.kind === "admin") {
        return (
          <AdminMessageCard
            msg={item.message}
            onMarkRead={(id) => void markAdminRead(id)}
            onDelete={onDeleteAdmin}
            adminTag={t("smartAlerts.adminTag")}
          />
        );
      }
      return (
        <AlertCard
          alert={item.alert}
          navigation={navigation}
          onMarkRead={onMarkAlertRead}
          onDelete={onDeleteAlert}
        />
      );
    },
    [
      markAdminRead,
      navigation,
      onDeleteAdmin,
      onDeleteAlert,
      onDeleteUser,
      onMarkAlertRead,
      onUserNotificationPress,
      t
    ]
  );

  const loading =
    userLoading ||
    adminLoading ||
    (Boolean(farmId) && listQuery.isPending && !listQuery.data);
  const farmListError = farmId ? listQuery.error : null;

  return (
    <MobileAppShell hideTopBar>
      {loading ? (
        <ActivityIndicator style={styles.center} color={mobileColors.accent} />
      ) : farmListError ? (
        <Text style={styles.err}>{(farmListError as Error).message}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
          refreshControl={
            <RefreshControl
              refreshing={
                refreshMutation.isPending ||
                listQuery.isFetching ||
                adminLoading ||
                userLoading
              }
              onRefresh={() => {
                if (farmId) {
                  refreshMutation.mutate();
                  void listQuery.refetch();
                }
                void refetchAdmin();
                void refetchUser();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {farmId ? t("smartAlerts.empty") : t("smartAlerts.adminEmpty")}
            </Text>
          }
        />
      )}
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 24 },
  err: {
    color: mobileColors.error,
    padding: mobileSpacing.lg
  },
  list: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 40
  }
});
