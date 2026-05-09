/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts`.
 */
import { getExpoPublicEnv } from "../env";

function apiBaseUrl(): string {
  const { apiUrl } = getExpoPublicEnv();
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL manquant");
  }
  return apiUrl.replace(/\/$/, "");
}

export function apiAuthHeaders(
  accessToken: string,
  activeProfileId?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (activeProfileId) {
    headers["X-Profile-Id"] = activeProfileId;
  }
  return headers;
}

/** GET JSON sous /api/v1/... avec Bearer (+ profil actif optionnel). */
export async function apiGetJson<T>(
  path: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    headers: apiAuthHeaders(accessToken, activeProfileId)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as T;
}

/** POST JSON /api/v1/... */
export async function apiPostJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as T;
}

/** PATCH JSON /api/v1/... */
export async function apiPatchJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...apiAuthHeaders(accessToken, activeProfileId),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as T;
}

export type FarmDto = {
  id: string;
  name: string;
  ownerId: string;
  speciesFocus: string;
  livestockMode: string;
  address: string | null;
  capacity: number | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
  livestockCategoryPolicies?: unknown;
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

/** Réponses GET .../animals et .../batches (Prisma + includes). */
export type AnimalListItem = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: string;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{ weightKg: string | number; measuredAt: string }>;
};

export type BatchListItem = {
  id: string;
  name: string;
  headcount: number;
  status: string;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights?: Array<{ avgWeightKg: string | number; measuredAt: string }>;
};

export function fetchFarmAnimals(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<AnimalListItem[]> {
  return apiGetJson<AnimalListItem[]>(
    `/farms/${farmId}/animals`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBatches(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<BatchListItem[]> {
  return apiGetJson<BatchListItem[]>(
    `/farms/${farmId}/batches`,
    accessToken,
    activeProfileId
  );
}

export type AnimalDetail = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: string;
  birthDate: string | null;
  status: string;
  notes: string | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{
    id: string;
    weightKg: string | number;
    measuredAt: string;
    note: string | null;
  }>;
};

export type BatchDetail = {
  id: string;
  name: string;
  headcount: number;
  status: string;
  notes: string | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{
    id: string;
    avgWeightKg: string | number;
    headcountSnapshot: number | null;
    measuredAt: string;
    note: string | null;
  }>;
};

export function fetchFarmAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiGetJson<AnimalDetail>(
    `/farms/${farmId}/animals/${animalId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBatch(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<BatchDetail> {
  return apiGetJson<BatchDetail>(
    `/farms/${farmId}/batches/${batchId}`,
    accessToken,
    activeProfileId
  );
}

export type PostAnimalWeightPayload = {
  weightKg: number;
  note?: string;
};

export type PostBatchWeightPayload = {
  avgWeightKg: number;
  headcountSnapshot?: number;
  note?: string;
};

export function postAnimalWeight(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: PostAnimalWeightPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/farms/${farmId}/animals/${animalId}/weights`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function postBatchWeight(
  accessToken: string,
  farmId: string,
  batchId: string,
  payload: PostBatchWeightPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/farms/${farmId}/batches/${batchId}/weights`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** GET /farms/:farmId/batches/:batchId/health-events — scopes healthRead. */
export type BatchHealthEventRow = {
  id: string;
  batchId: string;
  severity: "info" | "watch" | "urgent";
  title: string;
  body: string | null;
  recordedAt: string;
  recordedByUserId: string;
  recorder: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
};

export function fetchBatchHealthEvents(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<BatchHealthEventRow[]> {
  return apiGetJson<BatchHealthEventRow[]>(
    `/farms/${farmId}/batches/${batchId}/health-events`,
    accessToken,
    activeProfileId
  );
}

export type PostBatchHealthEventPayload = {
  severity: "info" | "watch" | "urgent";
  title: string;
  body?: string;
  recordedAt?: string;
};

export function postBatchHealthEvent(
  accessToken: string,
  farmId: string,
  batchId: string,
  payload: PostBatchHealthEventPayload,
  activeProfileId?: string | null
): Promise<BatchHealthEventRow> {
  return apiPostJson<BatchHealthEventRow>(
    `/farms/${farmId}/batches/${batchId}/health-events`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type FarmTaskDto = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  creator?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
};

export function fetchFarmTasks(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  status?: string
): Promise<FarmTaskDto[]> {
  const qs =
    status && status !== "all"
      ? `?status=${encodeURIComponent(status)}`
      : "";
  return apiGetJson<FarmTaskDto[]>(
    `/farms/${farmId}/tasks${qs}`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmTaskPayload = {
  title: string;
  description?: string;
  category?: string;
  priority?: "low" | "normal" | "high";
  status?: "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string;
};

export function createFarmTask(
  accessToken: string,
  farmId: string,
  payload: CreateFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  return apiPostJson<FarmTaskDto>(
    `/farms/${farmId}/tasks`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmTaskPayload = {
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: "low" | "normal" | "high";
  status?: "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string | null;
  completedAt?: string | null;
};

export function patchFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  payload: PatchFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  return apiPatchJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmPayload = {
  name: string;
  speciesFocus?: string;
  livestockMode?: "individual" | "batch" | "hybrid";
  address?: string;
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

export type AuthMeResponse = {
  user: {
    id: string;
    supabaseUserId: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    isActive: boolean;
  };
  profiles: Array<{
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
  }>;
  activeProfile: {
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
  } | null;
};

/** GET /api/v1/auth/me (Bearer = access_token Supabase). */
export async function fetchAuthMe(
  accessToken: string,
  activeProfileId?: string
): Promise<AuthMeResponse> {
  const url = `${apiBaseUrl()}/api/v1/auth/me`;
  const res = await fetch(url, {
    headers: apiAuthHeaders(accessToken, activeProfileId ?? null)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as AuthMeResponse;
}
