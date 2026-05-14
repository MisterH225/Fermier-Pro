import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  fetchFarmSmartAlerts,
  patchFarmSmartAlertRead
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { partitionSmartAlertsByPriority } from "../../services/smartAlerts/SmartAlertsEngine";
import { AlertCard } from "./AlertCard";

type SmartAlertsSectionProps = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId: string | null | undefined;
};

export function SmartAlertsSection({
  farmId,
  farmName,
  accessToken,
  activeProfileId
}: SmartAlertsSectionProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [infoOpen, setInfoOpen] = useState(false);

  const alertsQuery = useQuery({
    queryKey: ["smartAlerts", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmSmartAlerts(accessToken, farmId, activeProfileId),
    enabled: Boolean(farmId && accessToken)
  });

  const readMutation = useMutation({
    mutationFn: (alertId: string) =>
      patchFarmSmartAlertRead(accessToken, farmId, alertId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["smartAlerts", farmId] });
      void qc.invalidateQueries({
        queryKey: ["smartAlertsCount", farmId, activeProfileId]
      });
    }
  });

  const parts = useMemo(
    () => partitionSmartAlertsByPriority(alertsQuery.data?.items ?? []),
    [alertsQuery.data?.items]
  );

  const onMarkRead = useCallback(
    (id: string) => {
      readMutation.mutate(id);
    },
    [readMutation]
  );

  const visibleInfo = infoOpen ? parts.info : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.sectionTitle}>
          {t("smartAlerts.sectionTitle", "💡 Recommandations")}
        </Text>
        <Pressable
          onPress={() =>
            navigation.navigate("SmartAlertsList", { farmId, farmName })
          }
          hitSlop={12}
        >
          <Text style={styles.linkAll}>
            {t("smartAlerts.seeAll", "Tout voir")}
          </Text>
        </Pressable>
      </View>

      {alertsQuery.isPending && !alertsQuery.data ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : alertsQuery.error ? (
        <Text style={styles.err}>
          {(alertsQuery.error as Error).message}
        </Text>
      ) : (
        <>
          {parts.critical.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              navigation={navigation}
              onMarkRead={onMarkRead}
            />
          ))}
          {parts.warning.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              navigation={navigation}
              onMarkRead={onMarkRead}
            />
          ))}
          {parts.info.length > 0 ? (
            <>
              <Pressable
                onPress={() => setInfoOpen((v) => !v)}
                style={styles.infoToggle}
              >
                <Text style={styles.infoToggleTx}>
                  {infoOpen
                    ? t("smartAlerts.hideInfo", "Masquer infos")
                    : t("smartAlerts.showInfo", "Infos ({{n}})", {
                        n: parts.info.length
                      })}
                </Text>
              </Pressable>
              {visibleInfo.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  navigation={navigation}
                  onMarkRead={onMarkRead}
                />
              ))}
            </>
          ) : null}
          {alertsQuery.data?.items.length === 0 ? (
            <Text style={styles.empty}>
              {t("smartAlerts.empty", "Aucune recommandation pour le moment.")}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.sm
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 17,
    color: mobileColors.textPrimary
  },
  linkAll: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  err: { color: mobileColors.error, marginBottom: 8 },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  infoToggle: {
    alignSelf: "flex-start",
    marginBottom: mobileSpacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  infoToggleTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
