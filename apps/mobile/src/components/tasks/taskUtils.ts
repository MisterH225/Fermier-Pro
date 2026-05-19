import type { FarmTaskDto } from "../../lib/api";
import { mobileColors } from "../../theme/mobileTheme";

export type DueLabelTone = "neutral" | "today" | "overdue";

export function taskDueMeta(
  dueAt: string | null,
  status: string
): { label: string; tone: DueLabelTone } | null {
  if (!dueAt || status === "done" || status === "cancelled") {
    return null;
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dueDay = new Date(
    Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  );
  const diffDays = Math.round(
    (dueDay.getTime() - todayStart.getTime()) / 86_400_000
  );

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return {
      label: n === 1 ? "1 jour de retard" : `${n} jours de retard`,
      tone: "overdue"
    };
  }
  if (diffDays === 0) {
    return { label: "Aujourd'hui", tone: "today" };
  }
  if (diffDays === 1) {
    return { label: "1 jour", tone: "neutral" };
  }
  if (diffDays < 7) {
    return { label: `${diffDays} jours`, tone: "neutral" };
  }
  const weeks = Math.round(diffDays / 7);
  return {
    label: weeks === 1 ? "1 semaine" : `${weeks} semaines`,
    tone: "neutral"
  };
}

export function dueToneColor(tone: DueLabelTone): string {
  if (tone === "overdue") {
    return mobileColors.error;
  }
  if (tone === "today") {
    return mobileColors.warning;
  }
  return mobileColors.textSecondary;
}

export function priorityBadge(priority: string): {
  emoji: string;
  label: string;
} {
  if (priority === "urgent" || priority === "high") {
    return { emoji: "🔴", label: "Urgente" };
  }
  if (priority === "low") {
    return { emoji: "🔵", label: "Basse" };
  }
  return { emoji: "🟡", label: "Normale" };
}

export function assigneeLabel(task: FarmTaskDto): string | null {
  const n = task.assignee?.fullName?.trim();
  if (n) {
    return n;
  }
  if (task.assignee?.email) {
    return task.assignee.email;
  }
  return null;
}

export function apiStatusFromTab(tab: string): string | undefined {
  if (tab === "pending") {
    return "pending";
  }
  if (tab === "all") {
    return undefined;
  }
  return tab;
}
