/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts` (GET/POST/PATCH selon le cas).
 */
export * from "./api/http";
export * from "./api/auth";
export * from "./api/community-feed";
export * from "./api/merchant";
export * from "./api/producer";
export * from "./api/config";
export * from "./api/chat";
export * from "./api/farm-members";
export * from "./api/invitations";
export * from "./api/feed-stock";
export * from "./api/farms";
export * from "./api/cheptel";
export * from "./api/tasks";
export * from "./api/vet-consultations";
export * from "./api/dashboard";
export * from "./api/farm-health";
export * from "./api/finance";
export * from "./api/housing";
export * from "./api/marketplace";
export * from "./api/vet";
export * from "./api/onboarding";
export * from "./api/reports";
export * from "./api/ai";
export * from "./api/gestation";
export * from "./api/buyer";
export * from "./api/wallet";

import {
  apiBaseUrl,
  apiDeleteJson,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  apiPutJson
} from "./api/http";

// ─── Profil technicien (`/technicians/me`) ───────────────────────────────────

export type TechnicianFormationType =
  | "diplome"
  | "formation_courte"
  | "sur_le_tas"
  | "autodidacte";

export type TechnicianProfileDto = {
  id: string;
  userId: string;
  displayName?: string;
  experienceYearsCount: number | null;
  specializations: string[];
  formation: string | null;
  formationType: TechnicianFormationType | null;
  formationTypeLabel: string | null;
  formationDetails: string | null;
  graduationYear: number | null;
  pretensionSalarialeMensuelle: number | null;
  pretensionCurrency: string;
  locationCity: string | null;
  locationCountry: string | null;
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  isAvailable: boolean;
  availabilityNote: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  isPublic: boolean;
  onboardingComplete: boolean;
  isActive: boolean;
  distanceKm?: number | null;
  isSelf?: boolean;
};

export type UpsertTechnicianProfileBody = {
  experienceYears?: string;
  experienceYearsCount?: number;
  specializations?: string[];
  formation?: string;
  formationType?: TechnicianFormationType;
  formationDetails?: string;
  graduationYear?: number;
  pretensionSalarialeMensuelle?: number | null;
  pretensionCurrency?: string;
  locationCity?: string;
  locationCountry?: string;
  locationLat?: number;
  locationLng?: number;
  isAvailable?: boolean;
  availabilityNote?: string;
  bio?: string;
  profilePhotoUrl?: string;
  isPublic?: boolean;
  onboardingComplete?: boolean;
};

export type TechnicianDashboardDto = {
  farms: Array<{
    farmId: string;
    farmName: string;
    speciesFocus: string | null;
    role: string;
    scopes: string[];
  }>;
  activeFarmId: string | null;
  tasksTodayCount: number;
  alertsCount: number;
  kpis: {
    activeAlerts: number;
    overdueVaccines: number;
    gestationThisWeek: number;
    criticalStock: number;
  };
};

export type TechnicianActivityRowDto = {
  id: string;
  farmId: string;
  farmName: string;
  module: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

/** GET /api/v1/technicians/me/profile */
export function fetchTechnicianProfile(
  accessToken: string,
  activeProfileId?: string | null
): Promise<TechnicianProfileDto> {
  return apiGetJson<TechnicianProfileDto>(
    "/technicians/me/profile",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/search */
export function searchTechnicians(
  accessToken: string,
  params: {
    q?: string;
    city?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
    availableOnly?: boolean;
    experienceMin?: number;
    specialization?: string;
    salaryMax?: number;
  },
  activeProfileId?: string | null
): Promise<{ items: TechnicianProfileDto[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.city) qs.set("city", params.city);
  if (params.nearLat != null) qs.set("nearLat", String(params.nearLat));
  if (params.nearLng != null) qs.set("nearLng", String(params.nearLng));
  if (params.radiusKm != null) qs.set("radiusKm", String(params.radiusKm));
  if (params.availableOnly != null) {
    qs.set("availableOnly", String(params.availableOnly));
  }
  if (params.experienceMin != null) {
    qs.set("experienceMin", String(params.experienceMin));
  }
  if (params.specialization) qs.set("specialization", params.specialization);
  if (params.salaryMax != null) qs.set("salaryMax", String(params.salaryMax));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<{ items: TechnicianProfileDto[] }>(
    `/technicians/search${suffix}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/:userId/public-profile */
export function fetchTechnicianPublicProfile(
  accessToken: string,
  userId: string,
  activeProfileId?: string | null
): Promise<TechnicianProfileDto> {
  return apiGetJson<TechnicianProfileDto>(
    `/technicians/${encodeURIComponent(userId)}/public-profile`,
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/farms/:farmId/collaborators/invite-from-chat */
export function inviteCollaboratorFromChat(
  accessToken: string,
  farmId: string,
  payload: {
    peerUserId: string;
    roomId?: string;
    recipientKind: InvitationRecipientKind;
    permissions: InvitationPermissions;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<{
  ok: boolean;
  invitationId: string;
  roomId: string;
  messageId: string;
}> {
  return apiPostJson(
    `/farms/${farmId}/collaborators/invite-from-chat`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** PATCH /api/v1/technicians/me/profile */
export function upsertTechnicianProfile(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: UpsertTechnicianProfileBody
): Promise<unknown> {
  return apiPatchJson(
    "/technicians/me/profile",
    body,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/me/dashboard */
export function fetchTechnicianDashboard(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string
): Promise<TechnicianDashboardDto> {
  const q = farmId ? `?farmId=${encodeURIComponent(farmId)}` : "";
  return apiGetJson<TechnicianDashboardDto>(
    `/technicians/me/dashboard${q}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/me/activity */
export function fetchTechnicianActivity(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string,
  limit?: number
): Promise<TechnicianActivityRowDto[]> {
  const q = new URLSearchParams();
  if (farmId) q.set("farmId", farmId);
  if (limit != null) q.set("limit", String(limit));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<TechnicianActivityRowDto[]>(
    `/technicians/me/activity${suffix}`,
    accessToken,
    activeProfileId
  );
}

// ─── Indice prix porc (`/market/pig-price-index`) ────────────────────────────

export type PigPriceIndexPeriod = "7d" | "30d" | "3m" | "12m";

export type PigPriceIndexPointDto = {
  date: string;
  avgPricePerKg: number;
  listingAvgPrice: number | null;
  transactionCount: number;
  variationPct: number | null;
  limitedData: boolean;
};

export type PigPriceIndexSeriesDto = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: PigPriceIndexPointDto[];
};

export type PigPriceIndexChartDto = {
  period: PigPriceIndexPeriod;
  category: string;
  insufficientData: boolean;
  message: string | null;
  series: PigPriceIndexSeriesDto[];
  updatedAt: string;
};

export type PigPriceIndexTickerItemDto = {
  category: string;
  label: string;
  icon: string;
  pricePerKg: number | null;
  variationPct: number | null;
  color: string;
};

export type PigPriceIndexTickerDto = {
  items: PigPriceIndexTickerItemDto[];
  updatedAt: string;
};

export type PigPriceIndexStatsRowDto = {
  category: string;
  label: string;
  todayPrice: number | null;
  variation24h: number | null;
  variation7d: number | null;
  high30d: number | null;
  low30d: number | null;
  volume: number;
};

export type PigPriceIndexStatsDto = {
  rows: PigPriceIndexStatsRowDto[];
};

/** GET /api/v1/market/pig-price-index */
export function fetchPigPriceIndexChart(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d",
  category?: string
): Promise<PigPriceIndexChartDto> {
  const q = new URLSearchParams();
  q.set("period", period);
  if (category) q.set("category", category);
  return apiGetJson<PigPriceIndexChartDto>(
    `/market/pig-price-index?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/ticker */
export function fetchPigPriceIndexTicker(
  accessToken: string,
  activeProfileId?: string | null
): Promise<PigPriceIndexTickerDto> {
  return apiGetJson<PigPriceIndexTickerDto>(
    "/market/pig-price-index/ticker",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/stats */
export function fetchPigPriceIndexStats(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d"
): Promise<PigPriceIndexStatsDto> {
  return apiGetJson<PigPriceIndexStatsDto>(
    `/market/pig-price-index/stats?period=${encodeURIComponent(period)}`,
    accessToken,
    activeProfileId
  );
}

export type HybridPigPriceIndexDto = {
  price_per_kg: number | null;
  trend: "up" | "down" | "stable";
  variation_7d_pct: number | null;
  calculated_at: string | null;
  data_points_count: number;
};

export type PigPriceIndexDashboardDto = {
  hybrid: HybridPigPriceIndexDto;
  ticker: PigPriceIndexTickerDto;
  chart: PigPriceIndexChartDto;
  stats: PigPriceIndexStatsDto;
};

/** GET /api/v1/market/pig-price-index/dashboard — agrégat marketplace (1 requête) */
export function fetchPigPriceIndexDashboard(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d",
  category?: string
): Promise<PigPriceIndexDashboardDto> {
  const q = new URLSearchParams();
  q.set("period", period);
  if (category) {
    q.set("category", category);
  }
  return apiGetJson<PigPriceIndexDashboardDto>(
    `/market/pig-price-index/dashboard?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/hybrid — indice hybride anti-manipulation */
export function fetchHybridPigPriceIndex(
  accessToken: string,
  activeProfileId?: string | null
): Promise<HybridPigPriceIndexDto> {
  return apiGetJson<HybridPigPriceIndexDto>(
    "/market/pig-price-index/hybrid",
    accessToken,
    activeProfileId
  );
}

/** GET /farms/:farmId/settings — paramètres agrégés (source unique). */
export type FarmSettingsDto = {
  farm: {
    id: string;
    name: string;
    speciesFocus: string;
    livestockMode: "individual" | "batch" | "hybrid";
    address: string | null;
    locationSector: string | null;
    locationCity: string | null;
    locationCountry: string | null;
    latitude: number | null;
    longitude: number | null;
    housingBuildingsCount: number | null;
    housingPensPerBuilding: number | null;
    housingMaxPigsPerPen: number | null;
  };
  app: {
    language: "fr" | "en";
    dateFormat: string;
    timezone: string;
    theme: "light" | "dark" | "system";
    budgetAutoSuggest: boolean;
    dailySummaryHour: string | null;
    notificationExtra: Record<string, unknown> | null;
  };
  finance: {
    currencyCode: string;
    currencySymbol: string;
    lowBalanceThreshold: number | null;
  };
  alerts: {
    mortalityRateThresholdPct: number | null;
    lowBalanceThreshold: number | null;
    stockWarningDays: number;
    stockCriticalDays: number;
    starterMaxAvgWeightKg: number | null;
    starterMaxAvgAgeWeeks: number | null;
    pushStock: boolean;
    pushHealth: boolean;
    pushFinance: boolean;
    pushGestation: boolean;
    pushCheptel: boolean;
    pushMarket: boolean;
  };
  gestation: {
    gestationDurationDays: number;
    weaningDurationDays: number;
    vaccineSchedule: unknown;
  };
  profitability: {
    marketPricePerKg: number | null;
    icTargetStarter: number | null;
    icTargetGrowth: number | null;
    icTargetFattening: number | null;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  };
  gmqTargets: {
    gmqTargetStarter: number | null;
    gmqTargetGrowth: number | null;
    gmqTargetFattening: number | null;
    targetSaleWeightKg: number | null;
  };
};

export type PatchFarmSettingsPayload = {
  app?: Partial<FarmSettingsDto["app"]>;
  finance?: Partial<FarmSettingsDto["finance"]>;
  alerts?: Partial<FarmSettingsDto["alerts"]>;
  profitability?: Partial<{
    marketPricePerKg: number | null;
    icTargetStarter: number;
    icTargetGrowth: number;
    icTargetFattening: number;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  }>;
  gmqTargets?: Partial<FarmSettingsDto["gmqTargets"]>;
  gestation?: { weaningDurationDays?: number };
  farm?: {
    name?: string;
    livestockMode?: "individual" | "batch" | "hybrid";
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
};

export function fetchFarmSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmSettingsDto> {
  return apiGetJson<FarmSettingsDto>(
    `/farms/${farmId}/settings`,
    accessToken,
    activeProfileId
  );
}

export function patchFarmSettings(
  accessToken: string,
  farmId: string,
  payload: PatchFarmSettingsPayload,
  activeProfileId?: string | null
): Promise<FarmSettingsDto> {
  return apiPatchJson<FarmSettingsDto>(
    `/farms/${farmId}/settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type ProfitabilitySettingsDto = FarmSettingsDto["profitability"];

export function fetchProfitabilitySettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<ProfitabilitySettingsDto> {
  return fetchFarmSettings(accessToken, farmId, activeProfileId).then(
    (s) => s.profitability
  );
}

export type PatchProfitabilitySettingsPayload = NonNullable<
  PatchFarmSettingsPayload["profitability"]
>;

export function patchProfitabilitySettings(
  accessToken: string,
  farmId: string,
  payload: PatchProfitabilitySettingsPayload,
  activeProfileId?: string | null
): Promise<ProfitabilitySettingsDto> {
  return patchFarmSettings(
    accessToken,
    farmId,
    { profitability: payload },
    activeProfileId
  ).then((s) => s.profitability);
}

export * from "./api/predictions";
export * from "./api/profitability";
