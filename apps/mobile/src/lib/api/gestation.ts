import { apiGetJson, apiPostJson, apiPutJson, apiPatchJson } from "./http";

/** Module Gestation — `/farms/:farmId/gestation/...` et `/gestations`. */
export type GestationOverviewDto = {
  kpis: {
    activeGestations: number;
    birthsDueIn7Days: number;
    birthsDueThisMonth: number;
    sowsAvailableForMating: number;
    avgDaysBetweenFarrowing: number | null;
    avgLitterSize: number | null;
    neonatalMortalityPct: number | null;
  };
  birthsPerMonth: Array<{ month: string; count: number }>;
  upcomingBirths: Array<{
    gestationId: string;
    sowId: string;
    sowLabel: string;
    photoUrl: string | null;
    expectedBirthDate: string;
    daysRemaining: number;
    urgency: "critical" | "soon" | "active";
  }>;
};

export type GestationListItemDto = {
  id: string;
  farmId: string;
  sowId: string;
  sowLabel: string;
  boarLabel: string | null;
  matingDate: string;
  expectedBirthDate: string;
  gestationNumber: number;
  status: string;
  matingType: string;
  progress: {
    daysRemaining: number;
    progressPct: number;
    weekCurrent: number;
    weekTotal: number;
    urgency: "critical" | "soon" | "active" | null;
  } | null;
  sow: {
    id: string;
    publicId: string;
    tagCode: string | null;
    photoUrl: string | null;
    breed?: { name: string } | null;
  };
  checklistCompletionPct: number;
  sowPen?: { id: string; name: string; code: string | null } | null;
};

export type GestationDetailDto = GestationListItemDto & {
  vaccines: Array<{
    id: string;
    vaccineName: string;
    scheduledDate: string;
    administeredDate: string | null;
    status: string;
  }>;
  checklistItems: Array<{
    id: string;
    itemLabel: string;
    isChecked: boolean;
  }>;
  litter?: unknown;
  notes?: string | null;
};

export function fetchGestationOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<GestationOverviewDto> {
  return apiGetJson(
    `/farms/${farmId}/gestation/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  params?: { status?: string; filter?: string; q?: string }
): Promise<{ items: GestationListItemDto[] }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.filter) q.set("filter", params.filter);
  if (params?.q) q.set("q", params.q);
  const qs = q.toString();
  return apiGetJson(
    `/farms/${farmId}/gestation/gestations${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestationDetail(
  accessToken: string,
  farmId: string,
  gestationId: string,
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiGetJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}`,
    accessToken,
    activeProfileId
  );
}

export function createGestation(
  accessToken: string,
  farmId: string,
  body: {
    sowId: string;
    boarId?: string;
    matingType: "natural" | "artificial_insemination";
    matingDate: string;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPostJson(
    `/farms/${farmId}/gestation/gestations`,
    { ...body, farmId },
    accessToken,
    activeProfileId
  );
}

export function updateGestation(
  accessToken: string,
  farmId: string,
  gestationId: string,
  body: {
    boarId?: string | null;
    matingDate?: string;
    matingType?: "natural" | "artificial_insemination";
    notes?: string | null;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPutJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}`,
    body,
    accessToken,
    activeProfileId
  );
}

export function patchGestationStatus(
  accessToken: string,
  farmId: string,
  gestationId: string,
  status: "active" | "completed" | "aborted" | "lost",
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPatchJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}/status`,
    { status },
    accessToken,
    activeProfileId
  );
}

export function recordGestationLitter(
  accessToken: string,
  farmId: string,
  gestationId: string,
  body: {
    actualBirthDate: string;
    bornAlive: number;
    stillborn: number;
    mummified?: number;
    averageBirthWeightKg?: number;
    deliveryType: "normal" | "difficult" | "cesarean";
    vetAssistance?: boolean;
    notes?: string;
    penId?: string;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPostJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}/litter`,
    body,
    accessToken,
    activeProfileId
  );
}

export function administerGestationVaccine(
  accessToken: string,
  farmId: string,
  vaccineId: string,
  activeProfileId?: string | null
): Promise<{ vaccineId: string; healthRecordId: string }> {
  return apiPatchJson(
    `/farms/${farmId}/gestation/vaccines/${vaccineId}/administer`,
    {},
    accessToken,
    activeProfileId
  );
}

export function toggleGestationChecklistItem(
  accessToken: string,
  farmId: string,
  itemId: string,
  isChecked: boolean,
  activeProfileId?: string | null
) {
  return apiPatchJson(
    `/farms/${farmId}/gestation/checklist/${itemId}`,
    { isChecked },
    accessToken,
    activeProfileId
  );
}

export function fetchGestationAvailableSows(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
) {
  return apiGetJson<{ items: Array<{
    sowId: string;
    label: string;
    photoUrl: string | null;
    lastFarrowingDate: string | null;
    gestationCount: number;
    daysSinceWeaning: number | null;
    availability: "now" | "soon";
    availableInDays: number;
  }> }>(
    `/farms/${farmId}/gestation/available-sows`,
    accessToken,
    activeProfileId
  );
}

export type GestationAiMatingRecommendation = {
  sowId: string;
  sowLabel: string;
  boarId: string | null;
  boarLabel: string | null;
  suggestedDate: string;
  expectedBirthDate: string | null;
  reason: string;
};

export function fetchGestationAiMatingPlan(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{
  recommendations: GestationAiMatingRecommendation[];
  aiPowered?: boolean;
}> {
  return apiGetJson(
    `/farms/${farmId}/gestation/ai-mating-plan`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestationHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filter?: string
) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}` : "";
  return apiGetJson<{
    events: Array<{
      id: string;
      type: string;
      sowLabel: string;
      sowId: string;
      date: string;
      result?: string;
      notes?: string | null;
    }>;
    stats: Record<string, unknown>;
  }>(
    `/farms/${farmId}/gestation/history${q}`,
    accessToken,
    activeProfileId
  );
}
