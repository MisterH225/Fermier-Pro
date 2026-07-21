import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { ListSkeleton } from "../../components/common/SkeletonBlocks";
import {
  ProfileSectionEmpty,
  ProfileSectionLink,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { TaskDetailModal } from "../../components/tasks/TaskDetailModal";
import { TaskListView } from "../../components/tasks/TaskListView";
import { TechFarmSelector } from "../../components/technician/TechFarmSelector";
import { TechReadOnlyBanner } from "../../components/technician/TechReadOnlyBanner";
import {
  resolveTechActiveFarm,
  useTechActiveFarm
} from "../../context/TechActiveFarmContext";
import { useSession } from "../../context/SessionContext";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { useFarmTasksSocket } from "../../hooks/useFarmTasksSocket";
import type { FarmTaskDto } from "../../lib/api";
import {
  fetchFarmTasks,
  fetchTechnicianDashboard,
  patchFarmTaskStatus
} from "../../lib/api";
import { hasFarmScope } from "../../lib/menuVisibility";
import { getUserFacingError } from "../../lib/userFacingError";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";

/** Tâches assignées au technicien sur la ferme active. */
export function TechTasksScreen() {
  const { t } = useTranslation();
  const bottomChromePad = useBottomChromePad();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const { activeFarmId, setActiveFarmId } = useTechActiveFarm();
  const qc = useQueryClient();
  const [detail, setDetail] = useState<FarmTaskDto | null>(null);

  const currentUserId = authMe?.user.id ?? "";

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, activeFarmId, "tasks"],
    queryFn: () =>
      fetchTechnicianDashboard(
        accessToken!,
        activeProfileId,
        activeFarmId ?? undefined
      ),
    enabled: Boolean(accessToken)
  });

  const farms = dashQ.data?.farms ?? [];
  const farm = resolveTechActiveFarm(
    farms,
    activeFarmId,
    dashQ.data?.activeFarmId
  );
  const farmId = farm?.farmId;
  const canWriteTasks = Boolean(
    clientFeatures.tasks && hasFarmScope(farm?.scopes, "tasks.write")
  );
  const canReadTasks = Boolean(
    clientFeatures.tasks &&
      hasFarmScope(farm?.scopes, ["tasks.read", "tasks.write"])
  );

  const { tasksSocketStatus } = useFarmTasksSocket({
    farmId: farmId ?? "",
    accessToken: accessToken ?? "",
    enabled: Boolean(accessToken && farmId && canReadTasks)
  });

  const tasksQ = useQuery({
    queryKey: [
      "farmTasks",
      farmId,
      activeProfileId,
      "assigned",
      currentUserId
    ],
    queryFn: () =>
      fetchFarmTasks(
        accessToken!,
        farmId!,
        activeProfileId,
        undefined,
        currentUserId
      ),
    enabled: Boolean(accessToken && farmId && currentUserId && canReadTasks),
    refetchInterval: tasksSocketStatus === "connected" ? false : 30_000
  });

  const toggleMut = useMutation({
    mutationFn: (task: FarmTaskDto) =>
      patchFarmTaskStatus(
        accessToken!,
        farmId!,
        task.id,
        task.status === "done" ? "todo" : "done",
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
    },
    onError: (e: Error) =>
      Alert.alert(t("tasksScreen.errorTitle"), getUserFacingError(e, t))
  });

  const tasks = useMemo(() => {
    const rows = tasksQ.data ?? [];
    return rows.filter((r) => r.status !== "cancelled");
  }, [tasksQ.data]);

  const openFarmTasks = () => {
    if (!farm) return;
    navigation.navigate("FarmTasks", {
      farmId: farm.farmId,
      farmName: farm.farmName
    });
  };

  const showSkeleton = dashQ.isLoading || (Boolean(farm) && tasksQ.isLoading);

  return (
    <TechMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          styles.wrap,
          { paddingBottom: bottomChromePad }
        ]}
      >
        {farm ? (
          <TechFarmSelector
            farms={farms}
            selectedFarmId={farm.farmId}
            onSelect={setActiveFarmId}
          />
        ) : null}

        {showSkeleton ? (
          <ScreenSection title={t("tech.tasks.sectionMine")}>
            <ListSkeleton count={3} />
          </ScreenSection>
        ) : !farm ? (
          <ScreenSection title={t("tech.tasks.sectionMine")}>
            <ProfileSectionEmpty>{t("tech.tasks.noFarm")}</ProfileSectionEmpty>
          </ScreenSection>
        ) : (
          <>
            {!canWriteTasks && canReadTasks ? <TechReadOnlyBanner /> : null}

            <ScreenSection title={t("tech.tasks.sectionMine")}>
              {!canReadTasks ? (
                <ProfileSectionEmpty>
                  {t("tech.permissionDenied")}
                </ProfileSectionEmpty>
              ) : tasks.length === 0 ? (
                <ProfileSectionEmpty>
                  {t("tech.tasks.noAssigned")}
                </ProfileSectionEmpty>
              ) : (
                <TaskListView
                  tasks={tasks}
                  embedded
                  canToggle={canWriteTasks}
                  onPressTask={setDetail}
                  onToggleDone={(task) => {
                    if (!canWriteTasks) return;
                    toggleMut.mutate(task);
                  }}
                />
              )}
            </ScreenSection>

            <View style={styles.linkBlock}>
              <Text style={styles.farmHint} numberOfLines={1}>
                {farm.farmName}
              </Text>
              <ProfileSectionLink
                color={techColors.primary}
                label={t("tech.tasks.viewAllFarm")}
                onPress={openFarmTasks}
              />
            </View>
          </>
        )}
      </ScrollView>

      {farm && accessToken ? (
        <TaskDetailModal
          visible={Boolean(detail)}
          farmId={farm.farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          task={detail}
          canWrite={canWriteTasks}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1 },
  linkBlock: { gap: mobileSpacing.xs, marginTop: mobileSpacing.sm },
  farmHint: {
    ...mobileTypography.meta,
    color: techColors.textSecondary,
    paddingHorizontal: mobileSpacing.xs
  }
});
