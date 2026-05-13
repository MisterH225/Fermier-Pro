import type { AppTab } from "../components/layout/BottomTabBar";

/** Onglets barre basse producteur : Finance inséré entre cheptel et santé si module actif. */
export function producerShellTabs(financeEnabled: boolean): AppTab[] {
  const mid = financeEnabled
    ? (["cheptel", "finance", "health"] as const)
    : (["cheptel", "health"] as const);
  return ["home", ...mid, "profile"];
}

