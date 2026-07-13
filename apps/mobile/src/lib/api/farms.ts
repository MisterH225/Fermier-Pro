import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";
import type { FarmStatus } from "./auth";

export type FarmDto = {
  id: string;
  name: string;
  ownerId: string;
  speciesFocus: string;
  livestockMode: string;
  address: string | null;
  locationSector?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  capacity: number | null;
  latitude: string | null;
  longitude: string | null;
  status: FarmStatus;
  archivedAt: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  livestockCategoryPolicies?: unknown;
  housingBuildingsCount?: number | null;
  housingPensPerBuilding?: number | null;
  housingMaxPigsPerPen?: number | null;
  /** Scopes effectifs sur cette ferme (RBAC), renvoyés par `GET /farms/:id`. */
  effectiveScopes?: string[];
};

export function fetchFarms(
  accessToken: string,
  activeProfileId?: string | null
): Promise<FarmDto[]> {
  return apiGetJson<FarmDto[]>("/farms", accessToken, activeProfileId);
}

export function fetchFarm(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDto> {
  return apiGetJson<FarmDto>(`/farms/${farmId}`, accessToken, activeProfileId);
}

export function fetchAllFarms(
  accessToken: string,
  activeProfileId?: string | null
): Promise<FarmDto[]> {
  return apiGetJson<FarmDto[]>("/farms/all", accessToken, activeProfileId);
}

export type ArchiveFarmReason =
  | "temporarily_inactive"
  | "restructuring"
  | "end_of_season"
  | "other";

export function archiveFarm(
  accessToken: string,
  farmId: string,
  reason?: ArchiveFarmReason,
  activeProfileId?: string | null
): Promise<FarmDto> {
  return apiPatchJson<FarmDto>(
    `/farms/${farmId}/archive`,
    { reason },
    accessToken,
    activeProfileId
  );
}

export function restoreFarm(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDto> {
  return apiPatchJson<FarmDto>(
    `/farms/${farmId}/restore`,
    {},
    accessToken,
    activeProfileId
  );
}

export function deleteFarm(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}`,
    accessToken,
    activeProfileId
  );
}

export function setActiveFarm(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ activeFarmId: string }> {
  return apiPatchJson<{ activeFarmId: string }>(
    "/farms/active",
    { farmId },
    accessToken,
    activeProfileId
  );
}

export function getActiveFarm(
  accessToken: string,
  activeProfileId?: string | null
): Promise<FarmDto | null> {
  return apiGetJson<FarmDto | null>("/farms/active", accessToken, activeProfileId);
}
export type CreateFarmPayload = {
  name: string;
  speciesFocus?: string;
  livestockMode?: "individual" | "batch" | "hybrid";
  address?: string;
  locationSector?: string;
  locationCity?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
};

/**
 * POST /farms — exige en-tête **profil producteur** (ProducerProfileGuard).
 */
export function createFarm(
  accessToken: string,
  producerProfileId: string,
  payload: CreateFarmPayload
): Promise<FarmDto> {
  return apiPostJson<FarmDto>(
    "/farms",
    payload,
    accessToken,
    producerProfileId
  );
}
