export const TASK_CATEGORIES = [
  "vaccination",
  "exam",
  "treatment",
  "feed_stock",
  "maintenance",
  "cleaning",
  "animal_followup",
  "admin",
  "other"
] as const;

export type TaskCategoryKey = (typeof TASK_CATEGORIES)[number];

export function isTaskCategory(value: string): value is TaskCategoryKey {
  return (TASK_CATEGORIES as readonly string[]).includes(value);
}
