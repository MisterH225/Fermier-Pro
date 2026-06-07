import type {
  SmartAlertListItemDto,
  SmartAlertPriorityDto
} from "../../lib/api";

const PRIORITY_ORDER: Record<SmartAlertPriorityDto, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

export function sortSmartAlerts(
  items: SmartAlertListItemDto[]
): SmartAlertListItemDto[] {
  return [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

export function partitionSmartAlertsByPriority(items: SmartAlertListItemDto[]) {
  const sorted = sortSmartAlerts(items);
  return {
    critical: sorted.filter((i) => i.priority === "critical"),
    warning: sorted.filter((i) => i.priority === "warning"),
    info: sorted.filter((i) => i.priority === "info")
  };
}
