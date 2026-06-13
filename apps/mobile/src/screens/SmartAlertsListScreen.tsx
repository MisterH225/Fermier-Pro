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
  Text,
  View
} from "react-native";
import { useBottomInset } from "../hooks/useBottomInset";
import { MobileAppShell } from "../components/layout";
import { AdminMessageCard } from "../components/admin/AdminMessageCard";
import { AlertCard } from "../components/smartAlerts/AlertCard";
import { useAdminMessagesInbox } from "../hooks/useAdminMessagesInbox";
import { useSession } from "../context/SessionContext";
import {
  deleteFarmSmartAlert,
  fetchFarmSmartAlerts,
  patchFarmSmartAlertRead,
  postFarmSmartAlertsRefresh,
  type AdminMessageDto,
  type SmartAlertListItemDto
} from "../lib/api";
import { sortSmartAlerts } from "../services/smartAlerts/SmartAlertsEngine";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SmartAlertsList">;

type ListRow =
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
          { text: t("smartAlerts.delete"), style: "destructive", onPress: onConfirm }
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

  const onDeleteAlert = useCallback(
    (id: string) => {
      if (!farmId) {
        return;
      }
      confirmDelete(() => deleteAlertMutation.mutate(id));
    },
    [confirmDelete, deleteAlertMutation, farmId]
  );

  const rows = useMemo((): ListRow[] => {
    const adminRows: ListRow[] = adminMessages.map((m) => ({
      kind: "admin" as const,
      id: `admin-${m.id}`,
      message: m
    }));
    const alertRows: ListRow[] = sortSmartAlerts(listQuery.data?.items ?? []).map(
      (a) => ({
        kind: "alert" as const,
        id: a.id,
        alert: a
      })
    );
    return [...adminRows, ...alertRows];
  }, [adminMessages, listQuery.data?.items]);

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
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
    [markAdminRead, navigation, onDeleteAdmin, onDeleteAlert, onMarkAlertRead, t]
  );

  const loading =
    adminLoading || (Boolean(farmId) && listQuery.isPending && !listQuery.data);
  const farmListError = farmId ? listQuery.error : null;

  return (
    <MobileAppShell hideTopBar>
      {loading ? (
        <ActivityIndicator style={styles.center} color={mobileColors.accent} />
      ) : farmListError ? (
        <Text style={styles.err}>
          {(farmListError as Error).message}
        </Text>
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
                adminLoading
              }
              onRefresh={() => {
                if (farmId) {
                  refreshMutation.mutate();
                  void listQuery.refetch();
                }
                void refetchAdmin();
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
    padding: mobileSpacing.lg
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 32
  }
});
