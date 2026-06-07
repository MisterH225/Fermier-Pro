import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import type { FarmTaskDto } from "../../lib/api";
import { deleteFarmTask, patchFarmTaskStatus } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { taskCategoryMeta } from "./taskConstants";
import { priorityBadge, taskDueMeta } from "./taskUtils";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  task: FarmTaskDto | null;
  canWrite: boolean;
  onClose: () => void;
  onEdit?: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  });
}

function statusLabel(status: string, t: (k: string) => string): string {
  if (status === "pending" || status === "todo") {
    return t("tasksScreen.statusPending");
  }
  if (status === "in_progress") {
    return t("tasksScreen.statusInProgress");
  }
  if (status === "done") {
    return t("tasksScreen.statusDone");
  }
  return status;
}

export function TaskDetailModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  task,
  canWrite,
  onClose,
  onEdit
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmTasksPendingCount", farmId] });
  };

  const statusMut = useMutation({
    mutationFn: (status: "done" | "in_progress" | "pending") =>
      patchFarmTaskStatus(
        accessToken,
        farmId,
        task!.id,
        status === "pending" ? "todo" : status,
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("tasksScreen.errorTitle"), getUserFacingError(e, t))
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      deleteFarmTask(accessToken, farmId, task!.id, activeProfileId),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("tasksScreen.errorTitle"), getUserFacingError(e, t))
  });

  if (!task) {
    return null;
  }

  const cat = taskCategoryMeta(task.category);
  const prio = priorityBadge(task.priority);
  const due = taskDueMeta(task.dueAt, task.status);
  const animalLabel = task.animal
    ? `${task.animal.tagCode ?? task.animal.publicId} — ${task.animal.species.name}`
    : null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={task.title}
      statusBadge={{
        label: `${prio.emoji} ${prio.label}`,
        tone: "neutral"
      }}
      secondaryActions={
        canWrite
          ? [
              {
                key: "edit",
                icon: "create-outline",
                label: t("tasksScreen.edit"),
                onPress: () => onEdit?.()
              }
            ]
          : undefined
      }
      destructiveAction={
        canWrite
          ? {
              label: t("tasksScreen.delete"),
              onPress: () => {
                Alert.alert(
                  t("tasksScreen.delete"),
                  t("tasksScreen.deleteConfirm"),
                  [
                    { text: t("tasksScreen.cancel"), style: "cancel" },
                    {
                      text: t("tasksScreen.delete"),
                      style: "destructive",
                      onPress: () => deleteMut.mutate()
                    }
                  ]
                );
              }
            }
          : undefined
      }
      footerPrimary={
        canWrite && task.status !== "done" ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => statusMut.mutate("done")}
            disabled={statusMut.isPending}
          >
            {statusMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnTx}>
                {t("tasksScreen.markDone")}
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
    >
      <View style={styles.head}>
        <Text style={styles.emoji}>{cat.emoji}</Text>
        <Text style={styles.catName}>{t(cat.labelKey)}</Text>
      </View>

      <Row label={t("tasksScreen.detailAssignee")} value={task.assignee?.fullName ?? "—"} />
      <Row
        label={t("tasksScreen.detailCreator")}
        value={task.creator?.fullName ?? "—"}
      />
      <Row label={t("tasksScreen.detailDue")} value={formatDate(task.dueAt)} />
      {animalLabel ? (
        <Row label={t("tasksScreen.detailAnimal")} value={animalLabel} />
      ) : null}
      <Row label={t("tasksScreen.detailCategory")} value={t(cat.labelKey)} />
      {task.description ? (
        <>
          <Text style={styles.section}>{t("tasksScreen.detailDescription")}</Text>
          <Text style={styles.body}>{task.description}</Text>
        </>
      ) : null}
      <Row
        label={t("tasksScreen.detailStatus")}
        value={statusLabel(task.status, t)}
      />
      {due ? (
        <Text style={styles.dueHint}>
          {due.tone === "overdue" ? `🔴 ${due.label}` : due.label}
        </Text>
      ) : null}
    </BaseModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLab}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  emoji: { fontSize: 32 },
  catName: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowLab: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  rowVal: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    flex: 1,
    textAlign: "right"
  },
  section: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  dueHint: { ...mobileTypography.meta, marginTop: mobileSpacing.md },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnTx: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
