import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";
import type { PenAgeDataDto } from "./cheptel";

/** Logement — scopes housing.read / housing.write. */
export type BarnListItemDto = {
  id: string;
  farmId: string;
  name: string;
  code: string | null;
  notes: string | null;
  sortOrder: number;
  _count: { pens: number };
};

export type PenSummaryInBarnDto = {
  id: string;
  barnId: string;
  name: string;
  code: string | null;
  zoneLabel: string | null;
  capacity: number | null;
  status: string;
  sortOrder: number;
  /** Occupation en têtes (animaux actifs + effectif des bandes). */
  occupancy?: number;
  /** @deprecated Ancienne API housing — lignes de placement, pas têtes. */
  _count?: { placements: number };
};

export type BarnDetailDto = {
  id: string;
  farmId: string;
  name: string;
  code: string | null;
  notes: string | null;
  sortOrder: number;
  pens: PenSummaryInBarnDto[];
};

export function fetchFarmBarns(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<BarnListItemDto[]> {
  return apiGetJson<BarnListItemDto[]>(
    `/farms/${farmId}/barns`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBarn(
  accessToken: string,
  farmId: string,
  barnId: string,
  activeProfileId?: string | null
): Promise<BarnDetailDto> {
  return apiGetJson<BarnDetailDto>(
    `/farms/${farmId}/barns/${barnId}`,
    accessToken,
    activeProfileId
  );
}

export type PenPlacementDto = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    status: string;
  } | null;
  batch: {
    id: string;
    publicId: string;
    name: string;
    headcount: number;
    status: string;
  } | null;
};

export type PenLogDto = {
  id: string;
  penId: string;
  type: string;
  title: string;
  body: string | null;
  recordedAt: string;
  recordedByUserId: string;
  recorder: { id: string; fullName: string | null };
};

export type PenDetailDto = {
  id: string;
  barnId: string;
  name: string;
  code: string | null;
  zoneLabel: string | null;
  capacity: number | null;
  status: string;
  sortOrder: number;
  barn: { id: string; name: string; farmId: string };
  placements: PenPlacementDto[];
  logs: PenLogDto[];
  ageData: PenAgeDataDto;
};

export function fetchPenDetail(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<PenDetailDto> {
  return apiGetJson<PenDetailDto>(
    `/farms/${farmId}/pens/${penId}`,
    accessToken,
    activeProfileId
  );
}

export type CreateBarnPayload = {
  name: string;
  code?: string;
  notes?: string;
  sortOrder?: number;
};

/** Réponse POST bâtiment (sans agrégat `_count`). */
export type BarnMutationDto = {
  id: string;
  farmId: string;
  name: string;
  code: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function createFarmBarn(
  accessToken: string,
  farmId: string,
  payload: CreateBarnPayload,
  activeProfileId?: string | null
): Promise<BarnMutationDto> {
  return apiPostJson<BarnMutationDto>(
    `/farms/${farmId}/barns`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type UpdateBarnPayload = {
  name?: string;
  code?: string;
  notes?: string;
};

export function updateFarmBarn(
  accessToken: string,
  farmId: string,
  barnId: string,
  payload: UpdateBarnPayload,
  activeProfileId?: string | null
): Promise<BarnMutationDto> {
  return apiPatchJson<BarnMutationDto>(
    `/farms/${farmId}/barns/${barnId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmBarn(
  accessToken: string,
  farmId: string,
  barnId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/barns/${barnId}`,
    accessToken,
    activeProfileId
  );
}

export type StartPenPlacementPayload = {
  animalId?: string;
  batchId?: string;
  note?: string;
};

export function startPenPlacement(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: StartPenPlacementPayload,
  activeProfileId?: string | null
): Promise<PenPlacementDto> {
  return apiPostJson<PenPlacementDto>(
    `/farms/${farmId}/pens/${penId}/placements`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CreatePenPayload = {
  name: string;
  code?: string;
  zoneLabel?: string;
  capacity?: number;
  status?: string;
  sortOrder?: number;
};

export type PenMutationDto = {
  id: string;
  barnId: string;
  name: string;
  code: string | null;
  zoneLabel: string | null;
  capacity: number | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function createPen(
  accessToken: string,
  farmId: string,
  barnId: string,
  payload: CreatePenPayload,
  activeProfileId?: string | null
): Promise<PenMutationDto> {
  return apiPostJson<PenMutationDto>(
    `/farms/${farmId}/barns/${barnId}/pens`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PenLogTypeDto =
  | "cleaning"
  | "disinfection"
  | "mortality"
  | "treatment"
  | "other";

export type CreatePenLogPayload = {
  type: PenLogTypeDto;
  title: string;
  body?: string;
  recordedAt?: string;
};

export function createPenLog(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: CreatePenLogPayload,
  activeProfileId?: string | null
): Promise<PenLogDto> {
  return apiPostJson<PenLogDto>(
    `/farms/${farmId}/pens/${penId}/logs`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST …/pen-move — déplace animal ou bande vers une autre loge. */
export type PenMovePayload = {
  toPenId: string;
  fromPenId?: string;
  animalId?: string;
  batchId?: string;
  note?: string;
};

export type PenPlacementMovedDto = {
  id: string;
  penId: string;
  pen: { id: string; name: string };
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
  } | null;
  batch: {
    id: string;
    publicId: string;
    name: string;
    headcount: number;
  } | null;
};

export function postPenMove(
  accessToken: string,
  farmId: string,
  payload: PenMovePayload,
  activeProfileId?: string | null
): Promise<PenPlacementMovedDto | null> {
  return apiPostJson<PenPlacementMovedDto | null>(
    `/farms/${farmId}/pen-move`,
    payload,
    accessToken,
    activeProfileId
  );
}
