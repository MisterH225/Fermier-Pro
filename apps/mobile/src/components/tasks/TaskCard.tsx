import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmTaskDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { TaskViewMode } from "./taskConstants";
import { taskCategoryMeta } from "./taskConstants";
import {
  assigneeLabel,
  dueToneColor,
  priorityBadge,
  taskDueMeta
} from "./taskUtils";

type Props = {
  task: FarmTaskDto;
  mode: TaskViewMode;
  onPress: () => void;
  onToggleDone: () => void;
};

export function TaskCard({ task, mode, onPress, onToggleDone }: Props) {
  const cat = taskCategoryMeta(task.category);
  const due = taskDueMeta(task.dueAt, task.status);
  const prio = priorityBadge(task.priority);
  const assignee = assigneeLabel(task);
  const done = task.status === "done";

  const checkbox = (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        onToggleDone();
      }}
      style={[styles.checkbox, done && styles.checkboxOn]}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
    >
      {done ? <Text style={styles.checkMark}>✓</Text> : null}
    </Pressable>
  );

  if (mode === "list") {
    return (
      <Pressable style={styles.listCard} onPress={onPress}>
        <Text style={styles.priorityCorner}>{prio.emoji}</Text>
        <Text style={styles.listEmoji}>{cat.emoji}</Text>
        <View style={styles.listBody}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {assignee ? (
            <Text style={styles.assignee} numberOfLines={1}>
              Assigné : {assignee}
            </Text>
          ) : null}
          {due ? (
            <Text
              style={[
                styles.due,
                {
                  color: dueToneColor(due.tone),
                  fontWeight: due.tone === "overdue" ? "700" : "500"
                }
              ]}
            >
              {due.tone === "overdue" ? `🔴 ${due.label}` : due.label}
            </Text>
          ) : null}
        </View>
        {checkbox}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.gridCard} onPress={onPress}>
      <Text style={styles.priorityCorner}>{prio.emoji}</Text>
      <View style={styles.gridTop}>
        <Text style={styles.gridEmoji}>{cat.emoji}</Text>
        {checkbox}
      </View>
      <Text style={styles.title} numberOfLines={3}>
        {task.title}
      </Text>
      {assignee ? (
        <Text style={styles.assignee} numberOfLines={1}>
          Assigné : {assignee}
        </Text>
      ) : null}
      {due ? (
        <Text
          style={[
            styles.due,
            {
              color: dueToneColor(due.tone),
              fontWeight: due.tone === "overdue" ? "700" : "500"
            }
          ]}
        >
          {due.tone === "overdue" ? `🔴 ${due.label}` : due.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    minHeight: 148,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    ...mobileShadows.card,
    marginBottom: mobileSpacing.md
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card,
    gap: mobileSpacing.sm
  },
  priorityCorner: {
    position: "absolute",
    top: mobileSpacing.sm,
    left: mobileSpacing.sm,
    fontSize: mobileFontSize.sm
  },
  gridTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  gridEmoji: { fontSize: mobileFontSize.xxl },
  listEmoji: { fontSize: mobileFontSize.xxl, marginTop: mobileSpacing.md },
  listBody: { flex: 1, minWidth: 0 },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  assignee: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  due: { ...mobileTypography.meta, marginTop: 2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: mobileRadius.md,
    borderWidth: 2,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.surface
  },
  checkboxOn: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  checkMark: { color: mobileColors.onAccent, fontWeight: "800", fontSize: mobileFontSize.md }
});
