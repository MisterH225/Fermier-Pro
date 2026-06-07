import type { VetMainTab } from "./types";

const VET_TAB_ROUTES: Record<VetMainTab, string> = {
  home: "VeterinarianDashboard",
  agenda: "VetAgenda",
  farms: "VetFarms",
  messages: "VetMessages"
};

export function vetMainTabs(): VetMainTab[] {
  return ["home", "agenda", "farms", "messages"];
}

export function vetMainTabFromRoute(
  routeName: string | undefined
): VetMainTab | null {
  if (!routeName) {
    return null;
  }
  const entries = Object.entries(VET_TAB_ROUTES) as [VetMainTab, string][];
  const hit = entries.find(([, r]) => r === routeName);
  return hit?.[0] ?? null;
}

export function vetRouteForTab(tab: VetMainTab): string {
  return VET_TAB_ROUTES[tab];
}
