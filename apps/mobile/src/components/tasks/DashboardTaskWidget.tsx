import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFarmTasksSocket } from "../../hooks/useFarmTasksSocket";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { FarmTaskDto } from "../../lib/api";
import {
  fetchMyTasksDashboard,
  patchFarmTaskStatus
} from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { vetColors } from "../../theme/vetTheme";
import { TaskListView } from "./TaskListView";
import { TaskDetailModal } from "./TaskDetailModal";

type PeriodKey = "today" | "week" | "all";

type Props = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  /** Masque titre + filtres (déjà affichés par l’écran parent, ex. accueil véto). */
  embedded?: boolean;
  period?: PeriodKey;
  /** Override « Voir tout » (ex. dossier élevage véto au lieu de FarmTasks). */
  onViewAll?: () => void;
};

export function DashboardTaskWidget({
  farmId,
  farmName,
  accessToken,
  activeProfileId,
  embedded = false,
  period: periodProp,
  onViewAll
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const [internalPeriod, setInternalPeriod] = useState<PeriodKey>("today");
  const period = periodProp ?? internalPeriod;
  const [detail, setDetail] = useState<FarmTaskDto | null>(null);

  const { tasksSocketStatus } = useFarmTasksSocket({
    farmId,
    accessToken,
    enabled: true
  });

  const dashQ = useQuery({
    queryKey: ["farmTasksDashboard", farmId, activeProfileId, period],
    queryFn: () =>
      fetchMyTasksDashboard(accessToken, farmId, activeProfileId, period),
    refetchInterval: tasksSocketStatus === "connected" ? false : 30_000
  });

  const toggleMut = useMutation({
    mutationFn: (task: FarmTaskDto) =>
      patchFarmTaskStatus(
        accessToken,
        farmId,
        task.id,
        task.status === "done" ? "todo" : "done",
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
    }
  });

  const tasks = dashQ.data?.tasks ?? [];

  return (
    <View style={embedded ? styles.embeddedWrap : styles.wrap}>
      {!embedded ? (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>{t("tasksScreen.myTasks")}</Text>
            {dashQ.data?.pendingCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTx}>{dashQ.data.pendingCount}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.chips}>
            {(
              [
                ["today", t("tasksScreen.filterToday")],
                ["week", t("tasksScreen.filterWeek")],
                ["all", t("tasksScreen.filterAll")]
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.chip, period === key && styles.chipOn]}
                onPress={() => setInternalPeriod(key)}
              >
                <Text style={[styles.chipTx, period === key && styles.chipTxOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {dashQ.isPending ? (
        <ActivityIndicator style={{ marginVertical: mobileSpacing.md }} />
      ) : tasks.length === 0 ? (
        <Text style={styles.empty}>{t("tasksScreen.noTasks")}</Text>
      ) : (
        <TaskListView
          tasks={tasks}
          embedded={embedded}
          onPressTask={setDetail}
          onToggleDone={(task) => toggleMut.mutate(task)}
        />
      )}

      <Pressable
        style={styles.link}
        onPress={() => {
          if (onViewAll) {
            onViewAll();
            return;
          }
          navigation.navigate("FarmTasks", { farmId, farmName });
        }}
      >
        <Text style={styles.linkTx}>{t("tasksScreen.viewAll")}</Text>
      </Pressable>

      <TaskDetailModal
        visible={Boolean(detail)}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        task={detail}
        canWrite
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.lg
  },
  embeddedWrap: {
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  badge: {
    backgroundColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  badgeTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 12 },
  chips: { flexDirection: "row", gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  chipOn: { backgroundColor: mobileColors.accent, borderColor: mobileColors.accent },
  chipTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  chipTxOn: { color: mobileColors.onAccent, fontWeight: "700" },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    paddingVertical: mobileSpacing.md
  },
  link: { alignItems: "center", marginTop: mobileSpacing.sm },
  linkTx: { color: mobileColors.accent, fontWeight: "700" }
});
