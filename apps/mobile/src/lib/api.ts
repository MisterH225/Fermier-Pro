/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts` (GET/POST/PATCH selon le cas).
 */
import { getExpoPublicEnv, isDemoApiGetMockDisabled } from "../env";
import { tryDemoBypassApiGetJson } from "./demoApiGetBypass";

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
  const demo = isDemoApiGetMockDisabled()
    ? null
    : tryDemoBypassApiGetJson(path, accessToken);
  if (demo !== null) {
    return demo as T;
  }
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

/** PUT JSON /api/v1/... */
export async function apiPutJson<T>(
  path: string,
  body: unknown,
  accessToken: string,
  activeProfileId?: string | null
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    method: "PUT",
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

export type InvitationRecipientKind = "veterinarian" | "technician" | "partner";

export type InvitationPermissions = {
  readOnly?: boolean;
  dataEntry?: boolean;
  health?: boolean;
  finance?: boolean;
};

export type FarmInvitationKindDto = "share_link" | "scan_request";
export type FarmInvitationStatusDto =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

export type FarmInvitationPendingDto = {
  id: string;
  farmId: string;
  role: string | null;
  scopes: string[];
  expiresAt: string;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  createdAt: string;
  createdById: string;
  kind: FarmInvitationKindDto;
  status: FarmInvitationStatusDto;
  isDefault: boolean;
  permissions: InvitationPermissions | null;
  recipientKind: InvitationRecipientKind | null;
  scannedByUserId: string | null;
  scannedBy: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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
  role?: string;
  scopes?: string[];
  inviteeEmail?: string;
  inviteePhone?: string;
  recipientKind?: InvitationRecipientKind;
  permissions?: InvitationPermissions;
};

export type CreateFarmInvitationResultDto = {
  id: string;
  farmId: string;
  role: string | null;
  scopes: string[];
  recipientKind: InvitationRecipientKind | null;
  permissions: InvitationPermissions | null;
  expiresAt: string;
  token: string;
  isDefault: boolean;
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

/** GET /farms/:farmId/invitations/default — lien collaboratif par défaut + token QR. */
export type FarmDefaultInvitationDto = {
  id: string;
  farmId: string;
  token: string;
  expiresAt: string;
  isDefault: boolean;
  kind: FarmInvitationKindDto;
  status: FarmInvitationStatusDto;
};

export function fetchFarmDefaultInvitation(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDefaultInvitationDto> {
  return apiGetJson<FarmDefaultInvitationDto>(
    `/farms/${farmId}/invitations/default`,
    accessToken,
    activeProfileId
  );
}

/** GET /invitations/by-token/:token — aperçu après scan QR ou deep link. */
export type InvitationPreviewDto = {
  token: string;
  farmId: string;
  farmName: string;
  kind: FarmInvitationKindDto;
  status: FarmInvitationStatusDto;
  isDefault: boolean;
  role: string | null;
  scopes: string[];
  permissions: InvitationPermissions | null;
  recipientKind: InvitationRecipientKind | null;
  expiresAt: string;
  isOwner: boolean;
  alreadyMember: boolean;
  /** ID de la `scan_request` créée par le scan (si applicable). */
  pendingScanRequestId: string | null;
};

export function fetchInvitationByToken(
  accessToken: string,
  token: string,
  activeProfileId?: string | null
): Promise<InvitationPreviewDto> {
  return apiGetJson<InvitationPreviewDto>(
    `/invitations/by-token/${encodeURIComponent(token.trim())}`,
    accessToken,
    activeProfileId
  );
}

/** POST /invitations/:invitationId/respond — owner valide/refuse une demande. */
export type RespondInvitationPayload = {
  accept: boolean;
  recipientRole?: string;
  permissions?: InvitationPermissions;
};

export type RespondInvitationResultDto = {
  ok: boolean;
  invitationId: string;
  farmId: string;
  status: FarmInvitationStatusDto;
  role?: string | null;
};

export function respondToInvitation(
  accessToken: string,
  invitationId: string,
  payload: RespondInvitationPayload,
  activeProfileId?: string | null
): Promise<RespondInvitationResultDto> {
  return apiPostJson<RespondInvitationResultDto>(
    `/invitations/${invitationId}/respond`,
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

/** POST /farms/:farmId/invitations/regenerate — invalide l'ancien lien par défaut + crée un nouveau. */
export function regenerateFarmDefaultInvitation(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDefaultInvitationDto> {
  return apiPostJson<FarmDefaultInvitationDto>(
    `/farms/${farmId}/invitations/regenerate`,
    {},
    accessToken,
    activeProfileId
  );
}

// ─── Activité membres ─────────────────────────────────────────────────────────

export type MemberActivityLogDto = {
  id: string;
  farmId: string;
  memberId: string;
  module: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  member: {
    id: string;
    role: string;
    user: {
      id: string;
      fullName: string | null;
      email: string | null;
      avatarUrl: string | null;
    };
  };
};

export type FarmActivityLogsResult = {
  items: MemberActivityLogDto[];
  nextCursor: string | undefined;
};

export function fetchFarmActivityLogs(
  accessToken: string,
  farmId: string,
  opts?: {
    memberId?: string;
    module?: string;
    cursor?: string;
    limit?: number;
    activeProfileId?: string | null;
  }
): Promise<FarmActivityLogsResult> {
  const params = new URLSearchParams();
  if (opts?.memberId) params.set("member_id", opts.memberId);
  if (opts?.module) params.set("module", opts.module);
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiGetJson<FarmActivityLogsResult>(
    `/farms/${farmId}/activity-logs${qs ? `?${qs}` : ""}`,
    accessToken,
    opts?.activeProfileId
  );
}

/**
 * URL deep link de partage : `EXPO_PUBLIC_INVITE_BASE_URL` (HTTPS pour
 * universal link / web fallback) ou schéma de l'app par défaut.
 */
export function buildInvitationShareUrl(token: string): string {
  const cleaned = token.trim();
  const baseFromEnv =
    process.env.EXPO_PUBLIC_INVITE_BASE_URL?.trim() ?? "";
  if (baseFromEnv) {
    const stripped = baseFromEnv.replace(/\/$/, "");
    return `${stripped}/${encodeURIComponent(cleaned)}`;
  }
  return `fermier-pro://invite/${encodeURIComponent(cleaned)}`;
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

export type CheptelOverviewDto = {
  farm: {
    id: string;
    name: string;
    livestockMode: string;
    housingBuildingsCount: number | null;
    housingPensPerBuilding: number | null;
    housingMaxPigsPerPen: number | null;
  };
  kpis: {
    totalAnimals: number;
    maleAnimals: number;
    femaleAnimals: number;
    unknownSexAnimals: number;
    gestatingFemales: number;
    totalBatchHeadcount: number;
    activeBatchesCount: number;
    closedBatchesCount: number;
    penCapacityTotal: number;
    penOccupancyHeadcount: number;
    occupancyRate: number | null;
    barnCount: number;
  };
};

export function fetchFarmCheptelOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<CheptelOverviewDto> {
  return apiGetJson<CheptelOverviewDto>(
    `/farms/${farmId}/cheptel`,
    accessToken,
    activeProfileId
  );
}

export type UpdateFarmCheptelConfigPayload = {
  livestockMode?: "individual" | "batch" | "hybrid";
  housingBuildingsCount?: number | null;
  housingPensPerBuilding?: number | null;
  housingMaxPigsPerPen?: number | null;
};

export function updateFarmCheptelConfig(
  accessToken: string,
  farmId: string,
  payload: UpdateFarmCheptelConfigPayload,
  activeProfileId?: string | null
): Promise<FarmDto> {
  return apiPutJson<FarmDto>(
    `/farms/${farmId}/cheptel-config`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CheptelStatusLogRow = {
  id: string;
  farmId: string;
  entityType: string;
  entityId: string;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  createdAt: string;
  recorder: { id: string; fullName: string | null; email: string | null };
};

export function fetchFarmCheptelStatusLogs(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  query?: {
    from?: string;
    to?: string;
    entityType?: string;
    newStatus?: string;
    limit?: number;
  }
): Promise<CheptelStatusLogRow[]> {
  const q = new URLSearchParams();
  if (query?.from) {
    q.set("from", query.from);
  }
  if (query?.to) {
    q.set("to", query.to);
  }
  if (query?.entityType) {
    q.set("entityType", query.entityType);
  }
  if (query?.newStatus) {
    q.set("newStatus", query.newStatus);
  }
  if (query?.limit != null) {
    q.set("limit", String(query.limit));
  }
  const qs = q.toString();
  const path = `/farms/${farmId}/cheptel/status-logs${qs ? `?${qs}` : ""}`;
  return apiGetJson<CheptelStatusLogRow[]>(path, accessToken, activeProfileId);
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
  expectedExitAt?: string | null;
  closedAt?: string | null;
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
  expectedExitAt?: string | null;
  closedAt?: string | null;
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

export type PatchAnimalStatusPayload = {
  status: "active" | "dead" | "sold" | "reformed" | "transferred";
  note?: string | null;
};

export function patchAnimalStatus(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: PatchAnimalStatusPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPatchJson<AnimalDetail>(
    `/farms/${farmId}/animals/${animalId}/status`,
    payload,
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

/** Dashboard accueil producteur — scopes selon endpoint (finance, livestock, health). */
export type DashboardFinanceMonthPoint = {
  month: string;
  expenses: string;
  revenues: string;
  currency: "XOF" | string;
};

export type DashboardFinanceTimeseriesDto = {
  farmId: string;
  months: DashboardFinanceMonthPoint[];
};

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
};

export type DashboardFeedStockDto = {
  farmId: string;
  items: DashboardFeedStockItemDto[];
};

export function fetchDashboardFinanceTimeseries(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<DashboardFinanceTimeseriesDto> {
  return apiGetJson<DashboardFinanceTimeseriesDto>(
    `/farms/${farmId}/dashboard/finance-timeseries`,
    accessToken,
    activeProfileId
  );
}

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

/** Santé ferme — aligné sur `FarmHealthController` (`/farms/:farmId/health/...`). */
export type FarmHealthRecordKind =
  | "vaccination"
  | "disease"
  | "vet_visit"
  | "treatment"
  | "mortality";

export type FarmHealthEntityType = "animal" | "group";

export type FarmHealthOverviewDto = {
  farmId: string;
  activeDiseaseCount: number;
  nextVaccine: {
    at: string | null;
    vaccineName: string;
    healthRecordId: string;
  } | null;
  nextVetVisitModule: {
    at: string;
    reason: string | null;
    healthRecordId: string;
  } | null;
  nextVetConsultationLegacy: {
    id: string;
    subject: string;
    openedAt: string;
  } | null;
  mortalityRate30d: string;
  alerts: string[];
};

export type FarmHealthUpcomingDto = {
  farmId: string;
  vaccines: Array<{
    vaccineName: string;
    nextReminderAt: string | null;
    healthRecord: { id: string; entityType: FarmHealthEntityType; entityId: string };
  }>;
  vetVisits: Array<{
    id: string;
    occurredAt: string;
    status: string;
    vetVisit: { vetName: string; reason: string } | null;
  }>;
};

export type FarmHealthMortalityRateDto = {
  farmId: string;
  periodDays: number;
  headcountLost: number;
  rate: string;
};

export type FarmHealthRecorderPreview = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type FarmHealthRecordRowDto = {
  id: string;
  farmId: string;
  kind: FarmHealthRecordKind;
  entityType: FarmHealthEntityType;
  entityId: string;
  occurredAt: string;
  status: string;
  notes: string | null;
  attachmentUrl: string | null;
  vaccination?: {
    vaccineName: string;
    vaccineType: string | null;
    nextReminderAt: string | null;
  } | null;
  disease?: {
    diagnosis: string | null;
    caseStatus: string;
  } | null;
  vetVisit?: {
    vetName: string;
    reason: string;
    cost: string | number | null;
  } | null;
  treatment?: {
    drugName: string;
    startDate: string;
    endDate: string | null;
    cost: string | number | null;
  } | null;
  mortality?: {
    cause: string;
    livestockExitId: string | null;
  } | null;
  recorder?: FarmHealthRecorderPreview | null;
};

export type CreateFarmHealthRecordBody = {
  kind: FarmHealthRecordKind;
  entityType: FarmHealthEntityType;
  entityId: string;
  occurredAt?: string;
  status?: string;
  notes?: string;
  attachmentUrl?: string;
  detail: Record<string, unknown>;
};

export function fetchFarmHealthOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmHealthOverviewDto> {
  return apiGetJson<FarmHealthOverviewDto>(
    `/farms/${farmId}/health/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthUpcoming(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmHealthUpcomingDto> {
  return apiGetJson<FarmHealthUpcomingDto>(
    `/farms/${farmId}/health/upcoming`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthMortalityRate(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period?: "30" | "90"
): Promise<FarmHealthMortalityRateDto> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiGetJson<FarmHealthMortalityRateDto>(
    `/farms/${farmId}/health/mortality-rate${qs}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthEvents(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { kind?: FarmHealthRecordKind; status?: string; from?: string; to?: string }
): Promise<FarmHealthRecordRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.kind) {
    q.set("kind", filters.kind);
  }
  if (filters?.status) {
    q.set("status", filters.status);
  }
  if (filters?.from) {
    q.set("from", filters.from);
  }
  if (filters?.to) {
    q.set("to", filters.to);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmHealthRecordRowDto[]>(
    `/farms/${farmId}/health/events${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmHealthRecord(
  accessToken: string,
  farmId: string,
  body: CreateFarmHealthRecordBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events`,
    body,
    accessToken,
    activeProfileId
  );
}

export function linkFarmHealthRecordExpense(
  accessToken: string,
  farmId: string,
  recordId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson<{ ok: boolean }>(
    `/farms/${farmId}/health/events/${recordId}/link-transaction`,
    { expenseId },
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

/** Finance — scopes finance.read / finance.write. */
export type FinanceSummaryDto = {
  farmId: string;
  totalExpenses: string;
  totalRevenues: string;
  net: string;
  currency: string;
  currencySymbol?: string;
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

export type FinanceOverviewMonthPoint = {
  month: string;
  expenses: string;
  revenues: string;
  currency: string;
};

export type FinanceOverviewDto = {
  farmId: string;
  settings: {
    currencyCode: string;
    currencySymbol: string;
    lowBalanceThreshold: string | null;
  };
  month: {
    totalExpenses: string;
    totalRevenues: string;
    netMargin: string;
  };
  balanceAllTime: string;
  lowBalanceWarning: boolean;
  months3: FinanceOverviewMonthPoint[];
};

export type FinanceCategoryDto = {
  id: string;
  farmId: string;
  type: string;
  key: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
};

export type FinanceMergedTransactionDto = {
  id: string;
  kind: "expense" | "income";
  amount: string;
  currency: string;
  label: string;
  occurredAt: string;
  categoryLabel: string | null;
  categoryKey: string | null;
  financeCategoryId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  attachmentUrl: string | null;
  note: string | null;
  creator?: { id: string; fullName: string | null; email: string | null };
};

export type FinanceReportCategoryRow = {
  key: string;
  label: string;
  expenses: string;
  revenues: string;
  net: string;
};

export type FinanceReportDto = {
  farmId: string;
  period: "month" | "year";
  range: { start: string; end: string };
  currency: string;
  currencySymbol: string;
  totals: { expenses: string; revenues: string; net: string };
  byCategory: FinanceReportCategoryRow[];
  monthlyEvolution?: Array<{
    month: string;
    expenses: string;
    revenues: string;
    net: string;
  }>;
  topExpenseCategories?: Array<{
    key: string;
    label: string;
    expenses: string;
  }>;
};

export type FinanceProjectionDto = {
  farmId: string;
  currency: string;
  basedOnMonths: number;
  nextMonths: Array<{
    monthOffset: number;
    projectedExpenses: string;
    projectedRevenues: string;
    projectedNet: string;
  }>;
  deficitAlert: boolean;
};

export type FinanceMarginByBatchDto = {
  farmId: string;
  batchId: string;
  batchName: string;
  headcount: number;
  revenues: string;
  expensesAllocated: string;
  grossMargin: string;
  costPerHead: string;
  costPerKg: string | null;
};

export type FinanceSimulationDto = {
  farmId: string;
  currentBalance: string;
  simulatedAdditionalRevenue: string;
  projectedBalance: string;
};

export type FarmFinanceSettingsDto = {
  farmId: string;
  currencyCode: string;
  currencySymbol: string;
  lowBalanceThreshold: string | null;
};

export function fetchFinanceOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceOverviewDto> {
  return apiGetJson<FinanceOverviewDto>(
    `/farms/${farmId}/finance/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFinanceSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFinanceSettingsDto> {
  return apiGetJson<FarmFinanceSettingsDto>(
    `/farms/${farmId}/finance/settings`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmFinanceSettingsPayload = {
  currencyCode?: string;
  currencySymbol?: string;
  lowBalanceThreshold?: number | null;
};

export function patchFarmFinanceSettings(
  accessToken: string,
  farmId: string,
  payload: PatchFarmFinanceSettingsPayload,
  activeProfileId?: string | null
): Promise<FarmFinanceSettingsDto> {
  return apiPatchJson<FarmFinanceSettingsDto>(
    `/farms/${farmId}/finance/settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceCategories(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceCategoryDto[]> {
  return apiGetJson<FinanceCategoryDto[]>(
    `/farms/${farmId}/finance/categories`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceTransactions(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: {
    type?: "income" | "expense";
    financeCategoryId?: string;
    from?: string;
    to?: string;
  }
): Promise<FinanceMergedTransactionDto[]> {
  const qs = new URLSearchParams();
  if (filters?.type) qs.set("type", filters.type);
  if (filters?.financeCategoryId) {
    qs.set("financeCategoryId", filters.financeCategoryId);
  }
  if (filters?.from) qs.set("from", filters.from);
  if (filters?.to) qs.set("to", filters.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FinanceMergedTransactionDto[]>(
    `/farms/${farmId}/finance/transactions${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type PostFinanceTransactionPayload = {
  type: "income" | "expense";
  financeCategoryId?: string;
  amount: number;
  currency?: string;
  label: string;
  occurredAt?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  attachmentUrl?: string;
  note?: string;
};

export function postFinanceTransaction(
  accessToken: string,
  farmId: string,
  payload: PostFinanceTransactionPayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto | FarmRevenueDto> {
  return apiPostJson<FarmExpenseDto | FarmRevenueDto>(
    `/farms/${farmId}/finance/transactions`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceReport(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period: "month" | "year" = "month",
  month?: string,
  year?: string
): Promise<FinanceReportDto> {
  const qs = new URLSearchParams();
  qs.set("period", period);
  if (month) qs.set("month", month);
  if (year) qs.set("year", year);
  return apiGetJson<FinanceReportDto>(
    `/farms/${farmId}/finance/report?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceProjection(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FinanceProjectionDto> {
  return apiGetJson<FinanceProjectionDto>(
    `/farms/${farmId}/finance/projection`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceMarginByBatch(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<FinanceMarginByBatchDto> {
  return apiGetJson<FinanceMarginByBatchDto>(
    `/farms/${farmId}/finance/margin-by-batch?batchId=${encodeURIComponent(batchId)}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFinanceSimulation(
  accessToken: string,
  farmId: string,
  saleHeadcount: number,
  pricePerHead: number,
  activeProfileId?: string | null
): Promise<FinanceSimulationDto> {
  const qs = new URLSearchParams();
  qs.set("saleHeadcount", String(saleHeadcount));
  qs.set("pricePerHead", String(pricePerHead));
  return apiGetJson<FinanceSimulationDto>(
    `/farms/${farmId}/finance/simulation?${qs.toString()}`,
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

export type AuthMePrimaryFarm = {
  id: string;
  name: string;
};

export type AuthMeUser = {
  id: string;
  supabaseUserId: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  producerHomeFarmName: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeLocationLabel: string | null;
  homeLocationSource: "gps" | "manual" | null;
  isActive: boolean;
  notificationsEnabled: boolean;
  pushNotificationsRegistered: boolean;
};

export type AuthMeResponse = {
  user: AuthMeUser;
  /** Première ferme propriétaire (ordre de création), pour libellé accueil producteur. */
  primaryFarm: AuthMePrimaryFarm | null;
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

export type PatchMeProfilePayload = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  producerHomeFarmName?: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  homeLocationLabel?: string | null;
  homeLocationSource?: "gps" | "manual" | null;
  notificationsEnabled?: boolean;
  expoPushToken?: string | null;
  pushPlatform?: "ios" | "android" | "web" | "unknown" | null;
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

/** PATCH /api/v1/auth/me/profile — met à jour l’utilisateur courant (sans changer de profil métier). */
export function patchAuthProfile(
  accessToken: string,
  body: PatchMeProfilePayload,
  activeProfileId?: string | null
): Promise<AuthMeResponse> {
  return apiPatchJson<AuthMeResponse>(
    "/auth/me/profile",
    body,
    accessToken,
    activeProfileId ?? undefined
  );
}

/** Types alignés sur Prisma `ProfileType` (premiere connexion mobile). */
export type ProfileTypeChoice =
  | "producer"
  | "technician"
  | "veterinarian"
  | "buyer";

export type CreatedProfileDto = {
  id: string;
  type: string;
  displayName: string | null;
  isDefault: boolean;
};

/** POST /api/v1/profiles — sans `X-Profile-Id` (creation du premier profil). */
export function createProfile(
  accessToken: string,
  body: { type: ProfileTypeChoice; displayName?: string }
): Promise<CreatedProfileDto> {
  return apiPostJson<CreatedProfileDto>(
    "/profiles",
    body,
    accessToken,
    null
  );
}
