import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MobileAppShell } from "../components/layout";
import { AlertCard } from "../components/smartAlerts/AlertCard";
import { useSession } from "../context/SessionContext";
import {
  fetchFarmSmartAlerts,
  patchFarmSmartAlertRead,
  postFarmSmartAlertsRefresh,
  type SmartAlertListItemDto
} from "../lib/api";
import { sortSmartAlerts } from "../services/smartAlerts/SmartAlertsEngine";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SmartAlertsList">;

export function SmartAlertsListScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["smartAlerts", farmId, activeProfileId, "full"],
    queryFn: () =>
      fetchFarmSmartAlerts(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      postFarmSmartAlertsRefresh(accessToken!, farmId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
    }
  });

  const readMutation = useMutation({
    mutationFn: (alertId: string) =>
      patchFarmSmartAlertRead(
        accessToken!,
        farmId,
        alertId,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
    }
  });

  const onMarkRead = useCallback(
    (id: string) => {
      readMutation.mutate(id);
    },
    [readMutation]
  );

  const data = sortSmartAlerts(listQuery.data?.items ?? []);

  const renderItem = useCallback(
    ({ item }: { item: SmartAlertListItemDto }) => (
      <AlertCard
        alert={item}
        navigation={navigation}
        onMarkRead={onMarkRead}
      />
    ),
    [navigation, onMarkRead]
  );

  return (
    <MobileAppShell title={t("smartAlerts.listTitle", "Recommandations")}>
      <View style={styles.sub}>
        <Text style={styles.farmName} numberOfLines={1}>
          {farmName}
        </Text>
      </View>
      {listQuery.isPending && !listQuery.data ? (
        <ActivityIndicator style={styles.center} color={mobileColors.accent} />
      ) : listQuery.error ? (
        <Text style={styles.err}>
          {(listQuery.error as Error).message}
        </Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshMutation.isPending || listQuery.isFetching}
              onRefresh={() => {
                refreshMutation.mutate();
                void listQuery.refetch();
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {t("smartAlerts.empty", "Aucune recommandation pour le moment.")}
            </Text>
          }
        />
      )}
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  sub: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.sm
  },
  farmName: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  center: { marginTop: 24 },
  err: {
    color: mobileColors.error,
    padding: mobileSpacing.lg
  },
  list: {
    padding: mobileSpacing.lg,
    paddingBottom: 40
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 32
  }
});
