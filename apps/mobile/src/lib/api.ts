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

/** DELETE /api/v1/... — corps JSON optionnel (ex. `{ ok: true }`). */
export async function apiDeleteJson<T>(
  path: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: apiAuthHeaders(accessToken, activeProfileId)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

/** GET public (sans Bearer) — feature flags pour menus / modules. */
export type ClientConfigDto = {
  features: {
    marketplace: boolean;
    chat: boolean;
    vetConsultations: boolean;
    tasks: boolean;
    finance: boolean;
    housing: boolean;
    feedStock: boolean;
  };
};

export async function fetchClientConfig(): Promise<ClientConfigDto> {
  const url = `${apiBaseUrl()}/api/v1/config/client`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as ClientConfigDto;
}

/** REST chat — aligné sur `ChatController` (`/chat/...`). */
export type ChatSenderPreview = {
  id: string;
  fullName: string | null;
  email?: string | null;
};

export type ChatMessagePreview = {
  id: string;
  body: string;
  createdAt: string;
  sender: ChatSenderPreview;
};

export type ChatRoomMemberPreview = {
  userId: string;
  user: { id: string; fullName: string | null; email?: string | null };
};

export type ChatRoomListItem = {
  id: string;
  kind: string;
  farmId: string | null;
  directKey: string | null;
  title: string | null;
  farm?: { id: string; name: string } | null;
  messages?: ChatMessagePreview[];
  members?: ChatRoomMemberPreview[];
};

export type ChatMessageDto = {
  id: string;
  roomId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  sender: ChatSenderPreview;
};

export function fetchChatRooms(
  accessToken: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem[]> {
  return apiGetJson<ChatRoomListItem[]>(
    "/chat/rooms",
    accessToken,
    activeProfileId
  );
}

export function ensureFarmChatRoom(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem> {
  return apiPostJson<ChatRoomListItem>(
    `/chat/rooms/farm/${farmId}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function ensureDirectChatRoom(
  accessToken: string,
  peerUserId: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem> {
  return apiPostJson<ChatRoomListItem>(
    "/chat/rooms/direct",
    { peerUserId },
    accessToken,
    activeProfileId
  );
}

export type FarmMemberDto = {
  id: string;
  farmId: string;
  userId: string;
  role: string;
  scopes?: string[];
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
};

export function fetchFarmMembers(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmMemberDto[]> {
  return apiGetJson<FarmMemberDto[]>(
    `/farms/${farmId}/members`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmMemberPayload = {
  role?: string;
  scopes?: string[];
};

export function patchFarmMember(
  accessToken: string,
  farmId: string,
  membershipId: string,
  payload: PatchFarmMemberPayload,
  activeProfileId?: string | null
): Promise<FarmMemberDto> {
  return apiPatchJson<FarmMemberDto>(
    `/farms/${farmId}/members/${membershipId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function removeFarmMember(
  accessToken: string,
  farmId: string,
  membershipId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/members/${membershipId}`,
    accessToken,
    activeProfileId
  );
}

export type FarmInvitationPendingDto = {
  id: string;
  farmId: string;
  role: string;
  scopes: string[];
  expiresAt: string;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  createdAt: string;
  createdById: string;
};

export function fetchFarmPendingInvitations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmInvitationPendingDto[]> {
  return apiGetJson<FarmInvitationPendingDto[]>(
    `/farms/${farmId}/invitations`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmInvitationPayload = {
  role: string;
  scopes?: string[];
  inviteeEmail?: string;
  inviteePhone?: string;
};

export type CreateFarmInvitationResultDto = {
  id: string;
  farmId: string;
  role: string;
  expiresAt: string;
  token: string;
};

export function createFarmInvitation(
  accessToken: string,
  farmId: string,
  payload: CreateFarmInvitationPayload,
  activeProfileId?: string | null
): Promise<CreateFarmInvitationResultDto> {
  return apiPostJson<CreateFarmInvitationResultDto>(
    `/farms/${farmId}/invitations`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST /invitations/accept — rattacher le compte à une ferme via le jeton reçu. */
export type AcceptFarmInvitationResultDto = {
  ok: boolean;
  farmId: string;
  role: string;
  alreadyMember: boolean;
};

export function acceptFarmInvitationWithToken(
  accessToken: string,
  token: string,
  activeProfileId?: string | null
): Promise<AcceptFarmInvitationResultDto> {
  return apiPostJson<AcceptFarmInvitationResultDto>(
    "/invitations/accept",
    { token: token.trim() },
    accessToken,
    activeProfileId
  );
}

export type FeedStockLotDto = {
  id: string;
  farmId: string;
  productName: string;
  quantityKg: string | number;
  remainingKg: string | number;
  purchasedAt: string;
  supplierName: string | null;
  unitPrice: string | number | null;
  currency: string;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; fullName: string | null };
};

export function fetchFeedStockLots(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FeedStockLotDto[]> {
  return apiGetJson<FeedStockLotDto[]>(
    `/farms/${farmId}/feed-stock-lots`,
    accessToken,
    activeProfileId
  );
}

export type CreateFeedStockLotPayload = {
  productName: string;
  quantityKg: number;
  purchasedAt?: string;
  supplierName?: string;
  unitPrice?: number;
  currency?: string;
  notes?: string;
};

export function createFeedStockLot(
  accessToken: string,
  farmId: string,
  payload: CreateFeedStockLotPayload,
  activeProfileId?: string | null
): Promise<FeedStockLotDto> {
  return apiPostJson<FeedStockLotDto>(
    `/farms/${farmId}/feed-stock-lots`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function consumeFeedStockLot(
  accessToken: string,
  farmId: string,
  lotId: string,
  kg: number,
  activeProfileId?: string | null
): Promise<FeedStockLotDto> {
  return apiPatchJson<FeedStockLotDto>(
    `/farms/${farmId}/feed-stock-lots/${lotId}/consume`,
    { kg },
    accessToken,
    activeProfileId
  );
}

/** Titre d’une conversation directe à partir du salon renvoyé par l’API. */
export function directConversationTitle(
  room: ChatRoomListItem,
  myUserId: string
): string {
  const other = room.members?.find((m) => m.userId !== myUserId);
  return other?.user?.fullName?.trim() || "Message direct";
}

export type UserSearchResultDto = {
  id: string;
  fullName: string | null;
  email: string | null;
};

/** GET /chat/directory/users — recherche pour DM (q ≥ 2, utilisateurs partageant une ferme avec toi). */
export function searchUsersForChat(
  accessToken: string,
  query: string,
  activeProfileId?: string | null
): Promise<UserSearchResultDto[]> {
  const qs = new URLSearchParams({ q: query.trim() });
  return apiGetJson<UserSearchResultDto[]>(
    `/chat/directory/users?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function fetchChatMessages(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null,
  opts?: { cursor?: string; take?: number }
): Promise<ChatMessageDto[]> {
  const qs = new URLSearchParams();
  if (opts?.cursor) qs.set("cursor", opts.cursor);
  if (opts?.take != null) qs.set("take", String(opts.take));
  const q = qs.toString();
  return apiGetJson<ChatMessageDto[]>(
    `/chat/rooms/${roomId}/messages${q ? `?${q}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function postChatMessage(
  accessToken: string,
  roomId: string,
  body: string,
  activeProfileId?: string | null
): Promise<ChatMessageDto> {
  return apiPostJson<ChatMessageDto>(
    `/chat/rooms/${roomId}/messages`,
    { body },
    accessToken,
    activeProfileId
  );
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

/** GET/POST …/vet-consultations — scopes vet.read / vet.write. */
export type VetConsultationStatusDto =
  | "open"
  | "in_progress"
  | "resolved"
  | "cancelled";

export type VetConsultationListItemDto = {
  id: string;
  farmId: string;
  animalId: string | null;
  subject: string;
  summary: string | null;
  status: VetConsultationStatusDto;
  openedAt: string;
  closedAt: string | null;
  openedBy: { id: string; fullName: string | null };
  primaryVet: { id: string; fullName: string | null } | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
  } | null;
  attachments: Array<{ id: string }>;
};

export type VetConsultationAttachmentDto = {
  id: string;
  url: string;
  mimeType: string | null;
  label: string | null;
  createdAt: string;
  uploadedBy: { id: string; fullName: string | null };
};

export type VetConsultationDetailDto = Omit<
  VetConsultationListItemDto,
  "attachments" | "animal"
> & {
  attachments: VetConsultationAttachmentDto[];
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    status: string;
  } | null;
  openedBy: {
    id: string;
    fullName: string | null;
    email?: string | null;
  };
  primaryVet: {
    id: string;
    fullName: string | null;
    email?: string | null;
  } | null;
};

export function fetchVetConsultations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  status?: VetConsultationStatusDto
): Promise<VetConsultationListItemDto[]> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<VetConsultationListItemDto[]>(
    `/farms/${farmId}/vet-consultations${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetConsultation(
  accessToken: string,
  farmId: string,
  consultationId: string,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiGetJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}`,
    accessToken,
    activeProfileId
  );
}

export type CreateVetConsultationPayload = {
  subject: string;
  summary?: string;
  animalId?: string;
};

export function createVetConsultation(
  accessToken: string,
  farmId: string,
  payload: CreateVetConsultationPayload,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiPostJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchVetConsultationPayload = {
  subject?: string;
  summary?: string | null;
  status?: VetConsultationStatusDto;
  primaryVetUserId?: string | null;
};

export function patchVetConsultation(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: PatchVetConsultationPayload,
  activeProfileId?: string | null
): Promise<VetConsultationDetailDto> {
  return apiPatchJson<VetConsultationDetailDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** Finance — scopes finance.read / finance.write. */
export type FinanceSummaryDto = {
  farmId: string;
  totalExpenses: string;
  totalRevenues: string;
  net: string;
  currency: string;
};

export type FarmExpenseDto = {
  id: string;
  farmId: string;
  amount: string | number;
  currency: string;
  label: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
  createdByUserId: string;
  creator?: { id: string; fullName: string | null; email: string | null };
};

export type FarmRevenueDto = {
  id: string;
  farmId: string;
  amount: string | number;
  currency: string;
  label: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
  createdByUserId: string;
  creator?: { id: string; fullName: string | null; email: string | null };
};

export function fetchFinanceSummary(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FinanceSummaryDto> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FinanceSummaryDto>(
    `/farms/${farmId}/finance/summary${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmExpenses(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FarmExpenseDto[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmExpenseDto[]>(
    `/farms/${farmId}/finance/expenses${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmRevenues(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  range?: { from?: string; to?: string }
): Promise<FarmRevenueDto[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmRevenueDto[]>(
    `/farms/${farmId}/finance/revenues${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiGetJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiGetJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmExpensePayload = {
  amount: number;
  currency?: string;
  label: string;
  category?: string;
  note?: string;
  occurredAt?: string;
};

export function createFarmExpense(
  accessToken: string,
  farmId: string,
  payload: CreateFarmExpensePayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiPostJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/expenses`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmRevenuePayload = {
  amount: number;
  currency?: string;
  label: string;
  category?: string;
  note?: string;
  occurredAt?: string;
};

export function createFarmRevenue(
  accessToken: string,
  farmId: string,
  payload: CreateFarmRevenuePayload,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiPostJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmExpensePayload = {
  amount?: number;
  currency?: string;
  label?: string;
  category?: string | null;
  note?: string | null;
  occurredAt?: string;
};

export function patchFarmExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  payload: PatchFarmExpensePayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiPatchJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmRevenuePayload = {
  amount?: number;
  currency?: string;
  label?: string;
  category?: string | null;
  note?: string | null;
  occurredAt?: string;
};

export function patchFarmRevenue(
  accessToken: string,
  farmId: string,
  revenueId: string,
  payload: PatchFarmRevenuePayload,
  activeProfileId?: string | null
): Promise<FarmRevenueDto> {
  return apiPatchJson<FarmRevenueDto>(
    `/farms/${farmId}/finance/revenues/${revenueId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST pièce jointe (URL après dépôt stockage, ex. Supabase). */
export type AddVetConsultationAttachmentPayload = {
  url: string;
  mimeType?: string;
  label?: string;
};

export function addVetConsultationAttachment(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: AddVetConsultationAttachmentPayload,
  activeProfileId?: string | null
): Promise<VetConsultationAttachmentDto> {
  return apiPostJson<VetConsultationAttachmentDto>(
    `/farms/${farmId}/vet-consultations/${consultationId}/attachments`,
    payload,
    accessToken,
    activeProfileId
  );
}

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
  _count: { placements: number };
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

/** GET /marketplace/listings — JWT ; sans `mine` = catalogue publié. */
export type MarketplaceListingListItem = {
  id: string;
  sellerUserId?: string;
  title: string;
  description: string | null;
  unitPrice: string | number | null;
  quantity: number | null;
  currency: string;
  locationLabel: string | null;
  status: string;
  publishedAt: string | null;
  pickupAt?: string | null;
  pickupNote?: string | null;
  createdAt: string;
  updatedAt: string;
  farm: { id: string; name: string } | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
  } | null;
  seller?: { id: string; fullName: string | null };
};

export function fetchMarketplaceListings(
  accessToken: string,
  activeProfileId?: string | null,
  opts?: { mine?: boolean; status?: string }
): Promise<MarketplaceListingListItem[]> {
  const qs = new URLSearchParams();
  if (opts?.mine) {
    qs.set("mine", "true");
  }
  if (opts?.status) {
    qs.set("status", opts.status);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<MarketplaceListingListItem[]>(
    `/marketplace/listings${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferBrief = {
  id: string;
  listingId: string;
  buyerUserId: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  buyer?: { id: string; fullName: string | null; email: string | null };
};

export type MarketplaceListingDetail = MarketplaceListingListItem & {
  sellerUserId: string;
  seller: { id: string; fullName: string | null; email: string | null };
  myOffers?: MarketplaceOfferBrief[];
  offers?: MarketplaceOfferBrief[];
};

export function fetchMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingDetail> {
  return apiGetJson<MarketplaceListingDetail>(
    `/marketplace/listings/${listingId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchMarketplacePickupPayload = {
  pickupAt?: string | null;
  pickupNote?: string | null;
};

/** PATCH — vendeur ou acheteur retenu : rendez-vous de retrait (sans paiement in-app). */
export function patchMarketplacePickup(
  accessToken: string,
  listingId: string,
  payload: PatchMarketplacePickupPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPatchJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/pickup`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST — vendeur : retrait effectué, annonce passée en « vendue » (hors encaissement). */
export function completeMarketplaceHandover(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/complete-handover`,
    {},
    accessToken,
    activeProfileId
  );
}

export type PostMarketplaceOfferPayload = {
  offeredPrice: number;
  quantity?: number;
  message?: string;
};

/** POST /marketplace/listings/:listingId/offers — acheteur / même JWT. */
export function postMarketplaceOffer(
  accessToken: string,
  listingId: string,
  payload: PostMarketplaceOfferPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/marketplace/listings/${listingId}/offers`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferMineRow = {
  id: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    status: string;
    currency: string;
    farm: { id: string; name: string } | null;
    seller: { id: string; fullName: string | null };
    animal: { id: string; publicId: string; tagCode: string | null } | null;
  };
};

/** GET /marketplace/offers — offres où je suis acheteur. */
export function fetchMyMarketplaceOffers(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceOfferMineRow[]> {
  return apiGetJson<MarketplaceOfferMineRow[]>(
    "/marketplace/offers",
    accessToken,
    activeProfileId
  );
}

/** Vendeur : accepter une offre (annonce → vendue, autres offres refusées). */
export function acceptMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/listings/${listingId}/offers/${offerId}/accept`,
    {},
    accessToken,
    activeProfileId
  );
}

/** Vendeur : refuser une offre. */
export function rejectMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/listings/${listingId}/offers/${offerId}/reject`,
    {},
    accessToken,
    activeProfileId
  );
}

/** Acheteur : retirer une offre encore en attente. */
export function withdrawMarketplaceOffer(
  accessToken: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/offers/${offerId}/withdraw`,
    {},
    accessToken,
    activeProfileId
  );
}

export type CreateMarketplaceListingPayload = {
  farmId?: string;
  animalId?: string;
  title: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  currency?: string;
  locationLabel?: string;
};

/** POST /marketplace/listings — brouillon ; publication séparée. */
export function createMarketplaceListing(
  accessToken: string,
  payload: CreateMarketplaceListingPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    "/marketplace/listings",
    payload,
    accessToken,
    activeProfileId
  );
}

export type UpdateMarketplaceListingPayload = {
  title?: string;
  description?: string | null;
  unitPrice?: number | null;
  quantity?: number | null;
  currency?: string;
  locationLabel?: string | null;
};

/** PATCH /marketplace/listings/:id — vendeur, annonce non vendue / non annulée. */
export function updateMarketplaceListing(
  accessToken: string,
  listingId: string,
  payload: UpdateMarketplaceListingPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPatchJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST .../publish — passage en publié. */
export function publishMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/publish`,
    {},
    accessToken,
    activeProfileId
  );
}

/** POST .../cancel — annulation et offres en attente refusées. */
export function cancelMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem | null> {
  return apiPostJson<MarketplaceListingListItem | null>(
    `/marketplace/listings/${listingId}/cancel`,
    {},
    accessToken,
    activeProfileId
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
