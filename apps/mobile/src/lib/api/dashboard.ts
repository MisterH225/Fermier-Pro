import { apiGetJson } from "./http";

/** Dashboard accueil producteur — scopes selon endpoint (finance, livestock, health). */
export type DashboardGestationItemDto = {
  animalId: string;
  label: string;
  expectedFarrowingAt: string;
  daysRemaining: number;
  urgent: boolean;
};

export type DashboardGestationsDto = {
  farmId: string;
  items: DashboardGestationItemDto[];
};

export type DashboardHealthDto = {
  farmId: string;
  upcomingVaccines: Array<{
    taskId: string;
    title: string;
    dueAt: string | null;
    animalHint: string | null;
  }>;
  nextVetConsultation: {
    id: string;
    subject: string;
    openedAt: string;
    status: string;
  } | null;
  activeDiseaseCases: {
    count: number;
    byType: Array<{ title: string; count: number }>;
  };
  mortalityRate30d: string | null;
  mortalityWindowDays: number;
};

export type DashboardFeedStockItemDto = {
  productName: string;
  remainingKg: string;
  initialKg: string;
  ratio: number;
  level: "critical" | "medium" | "ok";
  critical: boolean;
  color?: string;
  daysRemaining: number | null;
  percentRemaining?: number | null;
  stockStatus?: FeedStockComputedStatus;
};

export type DashboardFeedStockDto = {
  farmId: string;
  items: DashboardFeedStockItemDto[];
};

export function fetchDashboardGestations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<DashboardGestationsDto> {
  return apiGetJson<DashboardGestationsDto>(
    `/farms/${farmId}/dashboard/gestations`,
    accessToken,
    activeProfileId
  );
}

export function fetchDashboardHealth(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<DashboardHealthDto> {
  return apiGetJson<DashboardHealthDto>(
    `/farms/${farmId}/dashboard/health`,
    accessToken,
    activeProfileId
  );
}
export function fetchDashboardFeedStock(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<DashboardFeedStockDto> {
  return apiGetJson<DashboardFeedStockDto>(
    `/farms/${farmId}/dashboard/feed-stock`,
    accessToken,
    activeProfileId
  );
}
