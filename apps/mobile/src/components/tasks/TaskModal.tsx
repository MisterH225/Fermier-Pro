import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { useModal } from "../modals/useModal";
import type { AnimalListItem, FarmMemberDto, FarmTaskDto } from "../../lib/api";
import {
  createFarmTask,
  fetchFarmAnimals,
  fetchFarmMembers,
  patchFarmTask
} from "../../lib/api";
import {
  isOfflineQueuedResult,
  offlineAwareMessage,
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { TaskDueDateField } from "./TaskDueDateField";
import {
  TASK_CATEGORIES,
  type TaskCategoryKey
} from "./taskConstants";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  currentUserId: string;
  profileType: string;
  task?: FarmTaskDto | null;
  onClose: () => void;
};

type ReminderKey = "j_minus_1" | "j_zero" | "both";

function memberLabel(m: FarmMemberDto): string {
  return m.user.fullName ?? m.user.email ?? m.user.phone ?? m.userId;
}

function animalLabel(a: AnimalListItem): string {
  const tag = a.tagCode?.trim() || a.publicId;
  return `${a.species.name} · ${tag}`;
}

export function TaskModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  currentUserId,
  profileType,
  task,
  onClose
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { open } = useModal();

  const isCollaborator =
    profileType === "veterinarian" || profileType === "technician";
  const isEdit = Boolean(task?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategoryKey>("other");
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">(
    "normal"
  );
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [reminder, setReminder] = useState<ReminderKey>("j_minus_1");

  const membersQ = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId, activeProfileId),
    enabled: visible
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId, "taskModal"],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: visible
  });

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("other");
    setPriority("normal");
    setAssignedUserId(isCollaborator ? currentUserId : null);
    setAnimalId(null);
    setDueAt("");
    setReminder("j_minus_1");
  };

  const assignees = useMemo(() => {
    const rows = membersQ.data ?? [];
    const byUser = new Map<string, FarmMemberDto>();

    for (const m of rows) {
      byUser.set(m.userId, m);
    }

    if (!byUser.has(currentUserId)) {
      byUser.set(currentUserId, {
        id: "self",
        farmId,
        userId: currentUserId,
        role: isCollaborator ? "self" : "owner",
        user: {
          id: currentUserId,
          fullName: t("tasksScreen.assignSelf"),
          email: null,
          phone: null
        }
      });
    }

    const list = Array.from(byUser.values());
    list.sort((a, b) => {
      if (a.userId === currentUserId) {
        return -1;
      }
      if (b.userId === currentUserId) {
        return 1;
      }
      return memberLabel(a).localeCompare(memberLabel(b));
    });
    return list;
  }, [
    membersQ.data,
    currentUserId,
    farmId,
    isCollaborator,
    t
  ]);

  const animals = animalsQ.data ?? [];

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      const cat = TASK_CATEGORIES.some((c) => c.key === task.category)
        ? (task.category as TaskCategoryKey)
        : "other";
      setCategory(cat);
      const p =
        task.priority === "urgent" || task.priority === "high"
          ? "urgent"
          : task.priority === "low"
            ? "low"
            : "normal";
      setPriority(p);
      setAssignedUserId(task.assignedUserId ?? null);
      setAnimalId(task.animalId ?? null);
      setDueAt(task.dueAt ? task.dueAt.slice(0, 10) : "");
      setReminder(
        (task.reminder as ReminderKey | null) ?? "j_minus_1"
      );
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset dépend du profil
  }, [visible, task, isCollaborator, currentUserId]);

  useEffect(() => {
    if (!visible || isEdit || assignedUserId) {
      return;
    }
    if (isCollaborator) {
      setAssignedUserId(currentUserId);
      return;
    }
    if (assignees.length === 1) {
      setAssignedUserId(assignees[0]!.userId);
    }
  }, [visible, isEdit, assignedUserId, isCollaborator, currentUserId, assignees]);

  const buildTaskPayload = () => {
    if (!title.trim()) {
      throw new Error(t("tasksScreen.errorTitleRequired"));
    }
    const assignee = isCollaborator
      ? assignedUserId ?? currentUserId
      : assignedUserId;
    if (!assignee) {
      throw new Error(t("tasksScreen.errorAssigneeRequired"));
    }
    return {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      assignedUserId: assignee,
      animalId: animalId ?? null,
      dueAt: dueAt.trim() ? `${dueAt.trim()}T12:00:00.000Z` : null,
      reminder
    };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: isEdit ? "tasks.patch" : "tasks.create",
    label: title.trim() || t("tasksScreen.createTitle"),
    assignLocalEntityId: !isEdit,
    mutationFn: async () => {
      const payload = buildTaskPayload();
      if (isEdit && task) {
        return patchFarmTask(
          accessToken,
          farmId,
          task.id,
          payload,
          activeProfileId
        );
      }
      return createFarmTask(
        accessToken,
        farmId,
        {
          ...payload,
          description: description.trim() || undefined,
          animalId: animalId ?? undefined,
          dueAt: dueAt.trim() ? `${dueAt.trim()}T12:00:00.000Z` : undefined,
          status: "pending"
        },
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const payload = buildTaskPayload();
      if (isEdit && task) {
        return {
          calls: [
            {
              method: "PATCH",
              path: `/farms/${farmId}/tasks/${task.id}`,
              body: {
                ...payload,
                priority:
                  payload.priority === "urgent" ? "high" : payload.priority
              }
            }
          ],
          invalidateRoots: [
            "farmTasks",
            "farmTasksDashboard",
            "farmTasksPendingCount"
          ]
        };
      }
      const body = {
        ...payload,
        description: description.trim() || undefined,
        animalId: animalId ?? undefined,
        dueAt: dueAt.trim() ? `${dueAt.trim()}T12:00:00.000Z` : undefined,
        status: "todo",
        priority: priority === "urgent" ? "high" : priority
      };
      return {
        calls: [
          {
            method: "POST",
            path: `/farms/${farmId}/tasks`,
            body
          }
        ],
        invalidateRoots: [
          "farmTasks",
          "farmTasksDashboard",
          "farmTasksPendingCount"
        ]
      };
    },
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksPendingCount", farmId] });
      onClose();
      if (isEdit) {
        open("success", {
          message: offlineAwareMessage(t, saved, "tasksScreen.saveSuccess"),
          autoDismissMs: 2000
        });
      } else if (!isOfflineQueuedResult(saved)) {
        const row = saved as FarmTaskDto;
        const name =
          row.assignee?.fullName ??
          row.assignee?.email ??
          t("tasksScreen.assignee");
        open("success", {
          message: t("tasksScreen.createSuccess", { name }),
          autoDismissMs: 2500
        });
      }
    },
    onQueued: () => {
      void qc.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksDashboard", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmTasksPendingCount", farmId] });
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2600
      });
    },
    onError: (e: Error) => Alert.alert(t("tasksScreen.errorTitle"), getUserFacingError(e, t))
  });

  return (
    <BaseModal
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title={
        isEdit ? t("tasksScreen.editTitle") : t("tasksScreen.createTitle")
      }
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnTx}>
              {isEdit ? t("tasksScreen.saveCta") : t("tasksScreen.createCta")}
            </Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("modals.sections.general")}>
        <Text style={styles.label}>{t("tasksScreen.fieldTitle")}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t("tasksScreen.fieldTitlePh")}
        />

        <Text style={styles.label}>{t("tasksScreen.fieldCategory")}</Text>
        <View style={styles.pillRow}>
          {TASK_CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.pill, category === c.key && styles.pillOn]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={[styles.pillTx, category === c.key && styles.pillTxOn]}>
                {c.emoji} {t(c.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("tasksScreen.fieldPriority")}</Text>
        <View style={styles.pillRow}>
          {(
            [
              ["urgent", "🔴", t("tasksScreen.priorityUrgent")],
              ["normal", "🟡", t("tasksScreen.priorityNormal")],
              ["low", "🔵", t("tasksScreen.priorityLow")]
            ] as const
          ).map(([key, emoji, lab]) => (
            <Pressable
              key={key}
              style={[styles.pill, priority === key && styles.pillOn]}
              onPress={() => setPriority(key)}
            >
              <Text style={[styles.pillTx, priority === key && styles.pillTxOn]}>
                {emoji} {lab}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("modals.sections.assignment")}>
        <Text style={styles.label}>{t("tasksScreen.fieldAssignee")}</Text>
        {membersQ.isPending ? (
          <ActivityIndicator style={styles.loader} />
        ) : assignees.length === 0 ? (
          <Text style={styles.muted}>{t("tasksScreen.fieldAssigneeEmpty")}</Text>
        ) : (
          <ScrollView style={styles.optionScroll} nestedScrollEnabled>
            {assignees.map((m) => (
              <Pressable
                key={m.userId}
                style={[
                  styles.optionRow,
                  assignedUserId === m.userId && styles.optionRowOn
                ]}
                onPress={() => setAssignedUserId(m.userId)}
              >
                <Text style={styles.optionTx}>{memberLabel(m)}</Text>
                {m.userId === currentUserId ? (
                  <Text style={styles.optionMeta}>{t("tasksScreen.assignSelf")}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={styles.label}>{t("tasksScreen.fieldAnimal")}</Text>
        {animalsQ.isPending ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <ScrollView style={styles.optionScroll} nestedScrollEnabled>
            <Pressable
              style={[styles.optionRow, !animalId && styles.optionRowOn]}
              onPress={() => setAnimalId(null)}
            >
              <Text style={styles.optionTx}>{t("tasksScreen.fieldAnimalNone")}</Text>
            </Pressable>
            {animals.length === 0 ? (
              <Text style={styles.muted}>{t("tasksScreen.fieldAnimalEmpty")}</Text>
            ) : (
              animals.map((a) => (
                <Pressable
                  key={a.id}
                  style={[
                    styles.optionRow,
                    animalId === a.id && styles.optionRowOn
                  ]}
                  onPress={() => setAnimalId(a.id)}
                >
                  <Text style={styles.optionTx}>{animalLabel(a)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </ModalSection>

      <ModalSection title={t("modals.sections.scheduling")}>
        <Text style={styles.label}>{t("tasksScreen.fieldDue")}</Text>
        <TaskDueDateField value={dueAt} onChange={setDueAt} farmId={farmId} />

        <Text style={styles.label}>{t("tasksScreen.fieldDescription")}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>{t("tasksScreen.fieldReminder")}</Text>
        <View style={styles.pillRow}>
          {(
            [
              ["j_minus_1", t("tasksScreen.reminderJ1")],
              ["j_zero", t("tasksScreen.reminderJ0")],
              ["both", t("tasksScreen.reminderBoth")]
            ] as const
          ).map(([key, lab]) => (
            <Pressable
              key={key}
              style={[styles.pill, reminder === key && styles.pillOn]}
              onPress={() => setReminder(key)}
            >
              <Text style={[styles.pillTx, reminder === key && styles.pillTxOn]}>
                {lab}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    ...mobileTypography.body
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surface,
    maxWidth: "100%"
  },
  pillOn: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  pillTx: { ...mobileTypography.meta, color: mobileColors.textPrimary },
  pillTxOn: { color: mobileColors.onAccent, fontWeight: "700" },
  optionScroll: { maxHeight: 168, marginBottom: mobileSpacing.xs },
  optionRow: {
    padding: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  optionRowOn: { backgroundColor: mobileColors.accentSoft },
  optionTx: { ...mobileTypography.body, color: mobileColors.textPrimary },
  optionMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  loader: { marginVertical: mobileSpacing.md },
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.6 }
});
