import { apiGetJson, apiPatchJson } from "./http";

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
