import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useScreenTitle } from "../../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { TasksModuleGate } from "../TasksModuleGate";
import { TabContent, TabSelector } from "../tabs";
import { MobileAppShell } from "../layout";
import { useSession } from "../../context/SessionContext";
import { useFarmTasksSocket } from "../../hooks/useFarmTasksSocket";
import type { FarmTaskDto } from "../../lib/api";
import { fetchFarmTasks, patchFarmTaskStatus } from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskGridView } from "./TaskGridView";
import { TaskListView } from "./TaskListView";
import { TaskModal } from "./TaskModal";
import { SegmentedControl } from "../ui/SegmentedControl";
import type { TaskTabKey, TaskViewMode } from "./taskConstants";
import {
  mobileRadius,
  mobileTypography
} from "../../theme/mobileTheme";
import { apiStatusFromTab } from "./taskUtils";
import { getQueryErrorMessage, getUserFacingError } from "../../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "FarmTasks">;

export function TasksScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("navigation.extended.tasks"));
  const {
    accessToken,
    activeProfileId,
    clientFeatures,
    authMe
  } = useSession();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TaskTabKey>("pending");
  const [viewMode, setViewMode] = useState<TaskViewMode>("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<FarmTaskDto | null>(null);
  const [detailTask, setDetailTask] = useState<FarmTaskDto | null>(null);

  const profileType = authMe?.activeProfile?.type ?? "producer";
  const currentUserId = authMe?.user.id ?? "";
  const canWrite = Boolean(clientFeatures.tasks);

  const statusParam = apiStatusFromTab(tab);

  const { tasksSocketStatus } = useFarmTasksSocket({
    farmId,
    accessToken: accessToken ?? "",
    enabled: Boolean(accessToken) && clientFeatures.tasks
  });

  const tasksQ = useQuery({
    queryKey: ["farmTasks", farmId, activeProfileId, tab],
    queryFn: () =>
      fetchFarmTasks(
        accessToken!,
        farmId,
        activeProfileId,
        statusParam
      ),
    enabled: Boolean(accessToken) && clientFeatures.tasks,
    refetchInterval:
      tasksSocketStatus === "connected" ? false : 30_000
  });

  const toggleMut = useMutation({
    mutationFn: (task: FarmTaskDto) =>
      patchFarmTaskStatus(
        accessToken!,
        farmId,
        task.id,
        task.status === "done" ? "todo" : "done",
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksPendingCount", farmId] });
    }
  });

  const tasks = useMemo(() => {
    const rows = (tasksQ.data ?? []) as FarmTaskDto[];
    if (tab === "done") {
      return rows.filter((r) => r.status === "done");
    }
    if (tab === "in_progress") {
      return rows.filter((r) => r.status === "in_progress");
    }
    if (tab === "pending") {
      return rows.filter(
        (r) => r.status === "pending" || r.status === "todo"
      );
    }
    return rows;
  }, [tasksQ.data, tab]);

  const tabs = useMemo(
    () => [
      { key: "pending", label: t("tasksScreen.tabPending") },
      { key: "in_progress", label: t("tasksScreen.tabInProgress") },
      { key: "done", label: t("tasksScreen.tabDone") }
    ],
    [t]
  );

  const openCreate = () => {
    setEditTask(null);
    setFormOpen(true);
  };

  const openEdit = (task: FarmTaskDto) => {
    setDetailTask(null);
    setEditTask(task);
    setFormOpen(true);
  };

  return (
    <TasksModuleGate>
      <View style={[styles.root, { backgroundColor: mobileColors.canvas }]}>
        <MobileAppShell hideTopBar omitBottomTabBar>
          {canWrite ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={openCreate}
                style={styles.addBtn}
                accessibilityRole="button"
                accessibilityLabel={t("tasksScreen.createCta")}
              >
                <Ionicons name="person-add-outline" size={18} color={mobileColors.onAccent} />
                <Text style={styles.addBtnTxt}>{t("collab.addMember")}</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.viewModeRow}>
            <SegmentedControl
              items={[
                { key: "grid", label: t("tasksScreen.viewGrid") },
                { key: "list", label: t("tasksScreen.viewList") }
              ]}
              activeKey={viewMode}
              onChange={(k) => setViewMode(k as TaskViewMode)}
            />
          </View>
          {tasksQ.isPending ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : tasksQ.error ? (
            <Text style={styles.err}>
              {tasksQ.error instanceof Error
                ? getUserFacingError(tasksQ.error, t)
                : t("tasksScreen.loadError")}
            </Text>
          ) : (
            <TabSelector
              activeTab={tab}
              onTabChange={(k) => setTab(k as TaskTabKey)}
              tabs={tabs.map((tb) => ({
                key: tb.key,
                label: tb.label,
                content: (
                  <TabContent>
                    {viewMode === "grid" ? (
                      <TaskGridView
                        tasks={tasks}
                        onPressTask={setDetailTask}
                        onToggleDone={(task) => toggleMut.mutate(task)}
                      />
                    ) : (
                      <TaskListView
                        tasks={tasks}
                        onPressTask={setDetailTask}
                        onToggleDone={(task) => toggleMut.mutate(task)}
                      />
                    )}
                  </TabContent>
                )
              }))}
            />
          )}
        </MobileAppShell>

        <TaskModal
          visible={formOpen}
          farmId={farmId}
          accessToken={accessToken!}
          activeProfileId={activeProfileId}
          currentUserId={currentUserId}
          profileType={profileType}
          task={editTask}
          onClose={() => {
            setFormOpen(false);
            setEditTask(null);
          }}
        />

        <TaskDetailModal
          visible={Boolean(detailTask)}
          farmId={farmId}
          accessToken={accessToken!}
          activeProfileId={activeProfileId}
          task={detailTask}
          canWrite={canWrite}
          onClose={() => setDetailTask(null)}
          onEdit={() => {
            if (detailTask) {
              openEdit(detailTask);
            }
          }}
        />
      </View>
    </TasksModuleGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  farmHint: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill
  },
  addBtnTxt: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  viewModeRow: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xs
  },
  err: {
    color: mobileColors.error,
    padding: mobileSpacing.lg
  }
});
