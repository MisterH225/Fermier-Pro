import type { TechMainTab } from "./types";

/**
 * Associe la route focalisée à un onglet principal technicien, ou `null` hors barre.
 */
export function techMainTabFromRoute(
  routeName: string | undefined,
  params?: Record<string, unknown>
): TechMainTab | null {
  if (!routeName) return null;
  switch (routeName) {
    case "TechnicianDashboard":
      return "home";
    case "TechTasks":
    case "FarmTasks":
      return "tasks";
    case "FarmHealth":
      return "vaccinations";
    case "FarmLivestock":
      return params?.initialTab === "weight" ? "weighings" : null;
    case "FarmFeedStock":
      return "feedStock";
    default:
      return null;
  }
}
