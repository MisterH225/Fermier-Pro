export type TaskCategoryKey =
  | "vaccination"
  | "exam"
  | "treatment"
  | "feed_stock"
  | "maintenance"
  | "cleaning"
  | "animal_followup"
  | "admin"
  | "other";

export const TASK_CATEGORIES: {
  key: TaskCategoryKey;
  emoji: string;
  labelKey: string;
}[] = [
  { key: "vaccination", emoji: "💉", labelKey: "tasksScreen.categories.vaccination" },
  { key: "exam", emoji: "🩺", labelKey: "tasksScreen.categories.exam" },
  { key: "treatment", emoji: "💊", labelKey: "tasksScreen.categories.treatment" },
  { key: "feed_stock", emoji: "🌾", labelKey: "tasksScreen.categories.feedStock" },
  {
    key: "maintenance",
    emoji: "🔧",
    labelKey: "tasksScreen.categories.maintenance"
  },
  { key: "cleaning", emoji: "🧹", labelKey: "tasksScreen.categories.cleaning" },
  {
    key: "animal_followup",
    emoji: "🐷",
    labelKey: "tasksScreen.categories.animalFollowup"
  },
  { key: "admin", emoji: "📋", labelKey: "tasksScreen.categories.admin" },
  { key: "other", emoji: "⚙️", labelKey: "tasksScreen.categories.other" }
];

export function taskCategoryMeta(key: string | null | undefined) {
  const found = TASK_CATEGORIES.find((c) => c.key === key);
  return found ?? TASK_CATEGORIES[TASK_CATEGORIES.length - 1]!;
}

export type TaskViewMode = "grid" | "list";

export type TaskTabKey = "pending" | "in_progress" | "done";
