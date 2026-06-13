import type { TechMainTab } from "./types";

const ROUTES: Record<TechMainTab, string> = {
  home: "TechnicianDashboard",
  tasks: "TechTasks",
  farm: "TechFarm",
  tracking: "TechTracking"
};

export function techMainTabFromRoute(routeName: string | undefined): TechMainTab | null {
  if (!routeName) return null;
  const hit = (Object.entries(ROUTES) as [TechMainTab, string][]).find(([, r]) => r === routeName);
  return hit?.[0] ?? null;
}
