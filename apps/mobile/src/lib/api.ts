/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts` (GET/POST/PATCH selon le cas).
 */
export * from "./api/http";
export * from "./api/auth";
export * from "./api/community-feed";

import {
  apiAuthHeaders,
  apiBaseUrl,
  apiDeleteJson,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  apiPutJson,
  formatApiErrorBody
} from "./api/http";
import type { FarmStatus, VetVerificationStatus } from "./api/auth";

/** GET public (sans Bearer) — feature flags pour menus / modules. */
export type PlatformModuleId =
  | "core_producer"
  | "technician"
  | "veterinarian"
  | "marketplace"
  | "buyer"
  | "collaboration"
  | "reports"
  | "ai_assistant"
  | "pig_price_index"
  | "gestation"
  | "nutrition";

export type PlatformModuleDto = {
  moduleId: PlatformModuleId;
  moduleName: string;
  icon: string | null;
  isActive: boolean;
  canDisable: boolean;
  userMessageFr: string | null;
  userMessageEn: string | null;
  scheduledReactivation: string | null;
};

export type SupportContactDto = {
  phone: string | null;
  telegramUrl: string | null;
};

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
  modules: PlatformModuleDto[];
  support?: SupportContactDto;
};

export async function fetchClientConfig(): Promise<ClientConfigDto> {
  const url = `${apiBaseUrl()}/api/v1/config/client`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.status, res.statusText));
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

export type ChatListingSummary = {
  id: string;
  title: string;
  category: string;
  currency: string;
  pricePerKg: number | null;
  totalWeightKg: number | null;
  photoUrls: string[];
};

export type ChatRoomListItem = {
  id: string;
  kind: string;
  farmId: string | null;
  directKey: string | null;
  title: string | null;
  marketplaceListingId?: string | null;
  unreadCount?: number;
  farm?: { id: string; name: string } | null;
  marketplaceListing?: ChatListingSummary | null;
  messages?: ChatMessagePreview[];
  members?: ChatRoomMemberPreview[];
};

export type ChatMessageDto = {
  id: string;
  roomId: string;
  senderUserId: string;
  body: string;
  wasModified?: boolean;
  modificationType?: "phone_masked" | "image_blocked" | null;
  createdAt: string;
  sender: ChatSenderPreview;
};

export type ChatImageAnalysisResult = {
  allowed: boolean;
  reason?: string;
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
  activeProfileId?: string | null,
  marketplaceListingId?: string | null
): Promise<ChatRoomListItem> {
  return apiPostJson<ChatRoomListItem>(
    "/chat/rooms/direct",
    {
      peerUserId,
      ...(marketplaceListingId
        ? { marketplaceListingId }
        : {})
    },
    accessToken,
    activeProfileId
  );
}

export function fetchChatRoom(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem> {
  return apiGetJson<ChatRoomListItem>(
    `/chat/rooms/${roomId}`,
    accessToken,
    activeProfileId
  );
}

export function markChatRoomRead(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiPostJson<{ ok: true }>(
    `/chat/rooms/${roomId}/read`,
    {},
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

// ─── Recherche collaborateur par identifiant (téléphone/email) ───────────────

export type CollaboratorIdentifierKindDto = "email" | "phone";

export type CollaboratorSearchUserDto = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  maskedIdentifier: string;
  identifierKind: CollaboratorIdentifierKindDto;
  profileTypes: string[];
  vetVerified: boolean;
};

export type CollaboratorSearchResultDto =
  | { status: "not_found" }
  | { status: "self" }
  | { status: "found"; user: CollaboratorSearchUserDto }
  | { status: "already_member"; user: CollaboratorSearchUserDto }
  | { status: "already_invited"; user: CollaboratorSearchUserDto };

export function searchCollaboratorByIdentifier(
  accessToken: string,
  farmId: string,
  identifier: string,
  activeProfileId?: string | null
): Promise<CollaboratorSearchResultDto> {
  return apiPostJson<CollaboratorSearchResultDto>(
    `/farms/${farmId}/collaborators/search`,
    { identifier },
    accessToken,
    activeProfileId
  );
}

export type InviteByIdentifierPayload = {
  userId: string;
  recipientKind: InvitationRecipientKind;
  permissions: InvitationPermissions;
  message?: string;
};

export type InviteByIdentifierResultDto = {
  ok: boolean;
  invitationId: string;
  farmId: string;
  recipientFirstName: string | null;
  status: FarmInvitationStatusDto;
};

export function inviteCollaboratorByIdentifier(
  accessToken: string,
  farmId: string,
  payload: InviteByIdentifierPayload,
  activeProfileId?: string | null
): Promise<InviteByIdentifierResultDto> {
  return apiPostJson<InviteByIdentifierResultDto>(
    `/farms/${farmId}/collaborators/invite-by-identifier`,
    payload,
    accessToken,
    activeProfileId
  );
}

// ─── Invitations reçues (côté invité) ────────────────────────────────────────

export type MyPendingInvitationDto = {
  id: string;
  farmId: string;
  farmName: string;
  farmSpecies: string | null;
  role: string | null;
  recipientKind: InvitationRecipientKind | null;
  permissions: InvitationPermissions | null;
  scopes: string[];
  message: string | null;
  expiresAt: string;
  createdAt: string;
  inviter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export function fetchMyPendingInvitations(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MyPendingInvitationDto[]> {
  return apiGetJson<MyPendingInvitationDto[]>(
    `/me/invitations/pending`,
    accessToken,
    activeProfileId
  );
}

export function respondToMyInvitation(
  accessToken: string,
  invitationId: string,
  accept: boolean,
  activeProfileId?: string | null
): Promise<{
  ok: boolean;
  invitationId: string;
  farmId: string;
  status: FarmInvitationStatusDto;
  role?: string | null;
}> {
  return apiPostJson(
    `/me/invitations/${invitationId}/respond`,
    { accept },
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

export type FeedTypeDto = {
  id: string;
  farmId: string;
  name: string;
  unit: "kg" | "tonne" | "sac";
  lowStockThresholdDays: number;
  color: string;
  weightPerBagKg: string | null;
  bagCountCurrent: string | null;
  lastCheckDate: string | null;
  lastEntryDate?: string | null;
  currentStockKg: string;
  productionPhase?: FeedProductionPhaseDto;
  phaseSuggestion?: FeedPhaseSuggestionDto | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedProductionPhaseDto =
  | "sous_mere"
  | "transition"
  | "starter"
  | "growth"
  | "fattening"
  | "breeder"
  | "unknown";

export type FeedPhaseSuggestionDto = {
  phase: FeedProductionPhaseDto;
  confidence: "high" | "medium" | "low";
  alternatives: FeedProductionPhaseDto[];
  label: string;
};

export type FeedStockComputedStatus = "ok" | "warning" | "critical" | "no_data";

export type FarmFeedOverviewDto = {
  farmId: string;
  totalStockKg: string;
  /** Statistiques enrichies par type (remplace `types` brut). */
  items: FarmFeedStatItemDto[];
};

export type FarmFeedChartSeriesDto = {
  feedTypeId: string;
  name: string;
  color: string;
  points: number[];
};

export type FarmFeedChartDto = {
  farmId: string;
  periodWeeks: number;
  weekKeys: string[];
  series: FarmFeedChartSeriesDto[];
};

export type FarmFeedStatItemDto = {
  feedTypeId: string;
  name: string;
  color: string;
  currentStockKg: string;
  weightPerBagKg: string | null;
  bagCountCurrent: string | null;
  lastCheckDate: string | null;
  avgDailyConsumptionKg: string | null;
  daysRemaining: number | null;
  estimatedDepletionDate: string | null;
  status: "ok" | "warning" | "critical";
  percentConsumed?: number | null;
  percentRemaining?: number | null;
  stockAtLastEntry?: string | null;
  daysSinceLastCheck?: number | null;
  hasSufficientData?: boolean;
  stockStatus?: FeedStockComputedStatus;
  stockStatusColor?: string;
};

export type FarmFeedStatsDto = {
  farmId: string;
  items: FarmFeedStatItemDto[];
};

export type SmartAlertModuleDto =
  | "stock"
  | "health"
  | "finance"
  | "gestation"
  | "cheptel"
  | "market";

export type SmartAlertPriorityDto = "critical" | "warning" | "info";

export type SmartAlertListItemDto = {
  id: string;
  ruleKey?: string;
  module: SmartAlertModuleDto;
  priority: SmartAlertPriorityDto;
  title: string;
  message: string;
  i18n?: {
    titleKey: string;
    messageKey: string;
    params?: Record<string, string | number>;
  };
  action?: {
    label: string;
    route: string;
    params?: Record<string, unknown>;
  };
  createdAt: string;
  isRead: boolean;
};

export type FarmSmartAlertsListDto = {
  farmId: string;
  items: SmartAlertListItemDto[];
};

export type FarmSmartAlertsCountDto = {
  farmId: string;
  criticalUnread: number;
};

export type FarmAlertSettingsDto = {
  id: string;
  farmId: string;
  mortalityRateThresholdPct: string | null;
  lowBalanceThreshold: string | null;
  stockWarningDays: number;
  stockCriticalDays: number;
  pushStock: boolean;
  pushHealth: boolean;
  pushFinance: boolean;
  pushGestation: boolean;
  pushCheptel: boolean;
  pushMarket: boolean;
};

export type FeedStockMovementDto = {
  id: string;
  farmId: string;
  feedTypeId: string;
  kind: "in" | "stock_check";
  quantityKg: string | null;
  bagsCounted: string | null;
  bagsConsumed: string | null;
  daysSinceLastCheck: number | null;
  dailyConsumptionKg: string | null;
  stockAfterKg: string;
  supplier: string | null;
  unitPrice: string | null;
  totalCost: string | null;
  notes: string | null;
  occurredAt: string;
  linkedExpenseId: string | null;
  isCostMissing: boolean;
  reconciliationDismissedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  feedType: { id: string; name: string; unit: string };
};

export type ReconciliationOfferDto = {
  status: "single" | "multiple" | "none";
  movementId?: string;
  expenseId?: string;
  stock?: {
    movementId: string;
    feedTypeName: string;
    quantityKg: string;
    occurredAt: string;
    supplier: string | null;
  };
  finance?: {
    expenseId: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
  };
  candidates?: Array<{
    expenseId: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
    daysDelta: number;
  }>;
  calculatedUnitPricePerKg?: number;
  currency?: string;
};

export type PostFarmFeedMovementResponse = {
  movement: FeedStockMovementDto;
  reconciliation: ReconciliationOfferDto | null;
};

export function fetchFarmFeedTypes(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FeedTypeDto[]> {
  return apiGetJson<FeedTypeDto[]>(
    `/farms/${farmId}/feed/types`,
    accessToken,
    activeProfileId
  );
}

export function createFarmFeedType(
  accessToken: string,
  farmId: string,
  payload: {
    name: string;
    unit: "kg" | "tonne" | "sac";
    color?: string;
    weightPerBagKg?: number;
    lowStockThresholdDays?: number;
    productionPhase?: FeedProductionPhaseDto;
  },
  activeProfileId?: string | null
): Promise<FeedTypeDto> {
  return apiPostJson<FeedTypeDto>(
    `/farms/${farmId}/feed/types`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function updateFarmFeedType(
  accessToken: string,
  farmId: string,
  feedTypeId: string,
  payload: {
    name?: string;
    productionPhase?: FeedProductionPhaseDto;
  },
  activeProfileId?: string | null
): Promise<FeedTypeDto> {
  return apiPatchJson<FeedTypeDto>(
    `/farms/${farmId}/feed/types/${feedTypeId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFeedTypesPhaseReview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FeedTypeDto[]> {
  return apiGetJson<FeedTypeDto[]>(
    `/farms/${farmId}/feed/types/phase-review`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFeedOverviewDto> {
  return apiGetJson<FarmFeedOverviewDto>(
    `/farms/${farmId}/feed/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedChart(
  accessToken: string,
  farmId: string,
  period: "3m" | "6m" | "12m",
  activeProfileId?: string | null
): Promise<FarmFeedChartDto> {
  return apiGetJson<FarmFeedChartDto>(
    `/farms/${farmId}/feed/chart?period=${encodeURIComponent(period)}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedStats(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmFeedStatsDto> {
  return apiGetJson<FarmFeedStatsDto>(
    `/farms/${farmId}/feed/stats`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmSmartAlerts(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  query?: { priority?: string; module?: string; unread?: string }
): Promise<FarmSmartAlertsListDto> {
  const qs = new URLSearchParams();
  if (query?.priority) qs.set("priority", query.priority);
  if (query?.module) qs.set("module", query.module);
  if (query?.unread) qs.set("unread", query.unread);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FarmSmartAlertsListDto>(
    `/farms/${farmId}/alerts${tail}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmSmartAlertsCount(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmSmartAlertsCountDto> {
  return apiGetJson<FarmSmartAlertsCountDto>(
    `/farms/${farmId}/alerts/count`,
    accessToken,
    activeProfileId
  );
}

export function postFarmSmartAlertsRefresh(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ synced: number }> {
  return apiPostJson<{ synced: number }>(
    `/farms/${farmId}/alerts/refresh`,
    {},
    accessToken,
    activeProfileId
  );
}

export function patchFarmSmartAlertRead(
  accessToken: string,
  farmId: string,
  alertId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPatchJson<{ ok: boolean }>(
    `/farms/${farmId}/alerts/${alertId}/read`,
    {},
    accessToken,
    activeProfileId
  );
}

export function fetchFarmAlertSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmAlertSettingsDto> {
  return apiGetJson<FarmAlertSettingsDto>(
    `/farms/${farmId}/alert-settings`,
    accessToken,
    activeProfileId
  );
}

export function putFarmAlertSettings(
  accessToken: string,
  farmId: string,
  payload: Partial<{
    mortalityRateThresholdPct: number | null;
    lowBalanceThreshold: number | null;
    stockWarningDays: number;
    stockCriticalDays: number;
    pushStock: boolean;
    pushHealth: boolean;
    pushFinance: boolean;
    pushGestation: boolean;
    pushCheptel: boolean;
    pushMarket: boolean;
  }>,
  activeProfileId?: string | null
): Promise<FarmAlertSettingsDto> {
  return apiPutJson<FarmAlertSettingsDto>(
    `/farms/${farmId}/alert-settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmFeedMovements(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  query?: { feedTypeId?: string; from?: string; to?: string }
): Promise<FeedStockMovementDto[]> {
  const qs = new URLSearchParams();
  if (query?.feedTypeId) qs.set("feedTypeId", query.feedTypeId);
  if (query?.from) qs.set("from", query.from);
  if (query?.to) qs.set("to", query.to);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<FeedStockMovementDto[]>(
    `/farms/${farmId}/feed/movements${tail}`,
    accessToken,
    activeProfileId
  );
}

export type PostFarmFeedMovementPayload = {
  kind: "in" | "stock_check";
  feedTypeId?: string;
  newFeedType?: {
    name: string;
    unit: "kg" | "tonne" | "sac";
    color?: string;
    weightPerBagKg?: number;
    lowStockThresholdDays?: number;
  };
  quantityInput?: number;
  quantityUnit?: "kg" | "tonne" | "sac";
  weightPerBagKg?: number;
  bagsCounted?: number;
  supplier?: string;
  unitPrice?: number;
  priceBasis?: "kg" | "sac";
  notes?: string;
  occurredAt?: string;
};

export function postFarmFeedMovement(
  accessToken: string,
  farmId: string,
  payload: PostFarmFeedMovementPayload,
  activeProfileId?: string | null
): Promise<PostFarmFeedMovementResponse> {
  return apiPostJson<PostFarmFeedMovementResponse>(
    `/farms/${farmId}/feed/movements`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmFeedMovementPayload = {
  feedTypeId?: string;
  quantityInput?: number;
  quantityUnit?: "kg" | "tonne" | "sac";
  weightPerBagKg?: number;
  bagsCounted?: number;
  supplier?: string;
  unitPrice?: number;
  totalCost?: number;
  priceBasis?: "kg" | "sac";
  notes?: string;
  occurredAt?: string;
};

export function patchFarmFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  payload: PatchFarmFeedMovementPayload,
  activeProfileId?: string | null
): Promise<PostFarmFeedMovementResponse> {
  return apiPatchJson<PostFarmFeedMovementResponse>(
    `/farms/${farmId}/feed/movements/${movementId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/feed/movements/${movementId}`,
    accessToken,
    activeProfileId
  );
}

export function reconcileFeedMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{
  movementId: string;
  expenseId: string;
  unitPricePerKg: number;
  currency: string;
}> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/reconcile`,
    { expenseId },
    accessToken,
    activeProfileId
  );
}

export function rejectFeedReconciliation(
  accessToken: string,
  farmId: string,
  movementId: string,
  body: { expenseId: string; totalCost?: number; supplier?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean; expenseId?: string; amount?: string }> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/reject-reconciliation`,
    body,
    accessToken,
    activeProfileId
  );
}

export function dismissFeedReconciliation(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson(
    `/farms/${farmId}/feed/movements/${movementId}/dismiss-reconciliation`,
    {},
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

export function analyzeChatImage(
  accessToken: string,
  imageBase64: string,
  mimeType: string,
  activeProfileId?: string | null
): Promise<ChatImageAnalysisResult> {
  return apiPostJson<ChatImageAnalysisResult>(
    "/chat/analyze-image",
    { imageBase64, mimeType },
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

export type CheptelCategoryBreakdownRow = {
  key: string;
  count: number;
};

export type CheptelHeadcountTrendPoint = {
  month: string;
  total: number;
};

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
    totalHeadcount: number;
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
    availablePensCount: number;
    unassignedAnimalsCount: number;
    sickAnimalsCount?: number;
    fatteningCount?: number;
    starterCount?: number;
    breedingFemalesCount?: number;
    breedingFemalesGestating?: number;
  };
  categoryBreakdown: CheptelCategoryBreakdownRow[];
  headcountTrend: CheptelHeadcountTrendPoint[];
  miniWidgets?: {
    categoryDonut: Array<{ label: string; count: number }>;
    breedingDonut: Array<{ label: string; count: number }>;
    fatteningTrend: number[];
    starterTrend: number[];
    occupancyDonut: Array<{ label: string; count: number }>;
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

export type PenCategoryKey =
  | "starter"
  | "fattening"
  | "maternity"
  | "quarantine"
  | "mixed"
  | "empty";

export type PenUsageTag =
  | "empty"
  | "sows"
  | "boar"
  | "boars"
  | "starter"
  | "fattening"
  | "mixed";

export type PenAgeDataDto = {
  averageAgeWeeksCalculated: number | null;
  averageAgeWeeksManual: number | null;
  animalsWithAgeCount: number;
  animalsWithoutAgeCount: number;
  displayAgeWeeks: number | null;
  isManual: boolean;
};

export type CheptelPenRowDto = {
  id: string;
  name: string;
  code: string | null;
  barnId: string;
  barnName: string;
  sortOrder: number;
  capacity: number;
  occupancy: number;
  occupancyRate: number | null;
  borderStatus: "healthy" | "warning" | "critical" | "empty";
  batchTypeTag: "starter" | "fattening" | null;
  sanitaryTag: "healthy" | "alert" | "critical" | "overcrowded" | "empty";
  category: PenCategoryKey;
  categoryForced: boolean;
  usageTag: PenUsageTag;
  maleCount: number;
  femaleCount: number;
  isActive: boolean;
  averageWeightKg: number | null;
  /** Présent si l’API cheptel est à jour ; absent sur cache / ancienne réponse. */
  ageData?: PenAgeDataDto;
  vaccineOverdueCount: number;
  gestationImminent: boolean;
  activeDiseaseCount: number;
};

export type CheptelPensResponseDto = {
  barns: Array<{ id: string; name: string; code?: string | null; sortOrder?: number }>;
  pens: CheptelPenRowDto[];
  totalPens?: number;
};

export type PenAnimalRowDto = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: "male" | "female" | "unknown";
  productionCategory?:
    | "breeding_female"
    | "breeding_male"
    | "fattening"
    | "starter"
    | "unknown";
  status: string;
  healthStatus?: "healthy" | "sick" | "recovering";
  photoUrl: string | null;
  birthDate?: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  currentAgeWeeks?: number | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{ weightKg: number; measuredAt: string }>;
  currentWeightKg: number | null;
  vaccineOverdue: boolean;
  activeGestation: {
    id: string;
    expectedFarrowingAt: string | null;
  } | null;
};

export type PenBatchRowDto = {
  id: string;
  publicId: string;
  name: string;
  headcount: number;
  categoryKey: string | null;
  status: string;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  avgWeightKg: number | null;
};

export type PenContentsDto = {
  ageData: PenAgeDataDto;
  animals: PenAnimalRowDto[];
  batches: PenBatchRowDto[];
};

export type ApplyDefaultPenLayoutResult = {
  batchesMigrated?: number;
  breedersPlaced?: number;
  productionPlaced?: number;
  rebalanced?: number;
  /** @deprecated Ancien format API */
  animalsPlaced?: number;
  batchesPlaced?: number;
};

/** Répartit truies, verrats et lots selon le plan onboarding (sujets sans loge). */
export function applyCheptelDefaultPenLayout(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<ApplyDefaultPenLayoutResult> {
  return apiPostJson<ApplyDefaultPenLayoutResult>(
    `/farms/${farmId}/cheptel/apply-default-layout`,
    {},
    accessToken,
    activeProfileId
  );
}

export function fetchCheptelPens(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  barnId?: string
): Promise<CheptelPensResponseDto> {
  const q = barnId ? `?barnId=${encodeURIComponent(barnId)}` : "";
  return apiGetJson<CheptelPensResponseDto>(
    `/farms/${farmId}/cheptel/pens${q}`,
    accessToken,
    activeProfileId
  );
}

export function fetchPenContents(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<PenContentsDto> {
  return apiGetJson<PenContentsDto>(
    `/farms/${farmId}/cheptel/pens/${penId}/animals`,
    accessToken,
    activeProfileId
  );
}

export function patchPenToggleActive(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<{ id: string; status: string }> {
  return apiPatchJson(
    `/farms/${farmId}/cheptel/pens/${penId}/toggle-active`,
    {},
    accessToken,
    activeProfileId
  );
}

export function patchPenAverages(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: {
    averageWeightKg?: number | null;
    averageAgeWeeksManual?: number | null;
  },
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPatchJson(
    `/farms/${farmId}/cheptel/pens/${penId}/averages`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteCheptelPen(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson(
    `/farms/${farmId}/cheptel/pens/${penId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchPenPayload = {
  name?: string;
  capacity?: number | null;
  status?: string;
  category?: PenCategoryKey;
  categoryForced?: boolean;
  averageWeightKg?: number | null;
  averageAgeWeeksManual?: number | null;
  zoneLabel?: string | null;
};

export function patchPen(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: PatchPenPayload,
  activeProfileId?: string | null
): Promise<PenMutationDto> {
  return apiPatchJson<PenMutationDto>(
    `/farms/${farmId}/pens/${penId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CheptelHistoryItemDto = {
  id: string;
  type: "status" | "weight" | "transfer" | "creation" | "pen_created" | "sold";
  occurredAt: string;
  title: string;
  subtitle: string | null;
  entityType: string | null;
  entityId: string | null;
  meta?: unknown;
};

export function fetchCheptelHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  query?: { type?: string; limit?: number }
): Promise<CheptelHistoryItemDto[]> {
  const q = new URLSearchParams();
  if (query?.type) {
    q.set("type", query.type);
  }
  if (query?.limit != null) {
    q.set("limit", String(query.limit));
  }
  const qs = q.toString();
  return apiGetJson<CheptelHistoryItemDto[]>(
    `/farms/${farmId}/cheptel/history${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export type GmqAnimalSummaryDto = {
  animalId: string;
  label: string;
  entryWeight: number | null;
  currentWeight: number | null;
  totalGainKg: number | null;
  latestGmq: number | null;
  avgGmq: number | null;
  targetGmqGPerDay: number | null;
  targetSaleWeightKg: number | null;
  status: "ok" | "warn" | "critical";
};

export type CheptelGmqSummaryDto = {
  animals: GmqAnimalSummaryDto[];
  settings: Array<{
    id: string;
    categoryKey: string;
    targetGmqGPerDay: string | number | null;
    targetSaleWeightKg: string | number | null;
    alertThresholdGmq: string | number | null;
  }>;
};

export function fetchCheptelGmqSummary(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<CheptelGmqSummaryDto> {
  return apiGetJson<CheptelGmqSummaryDto>(
    `/farms/${farmId}/cheptel/gmq/summary`,
    accessToken,
    activeProfileId
  );
}

export type DetectedBatchDto = {
  id: string;
  name: string;
  category: string;
  headcount: number;
  avgAgeWeeks: number | null;
  avgWeightKg: number | null;
  penNames: string[];
  animalIds: string[];
};

export function fetchDetectedBatches(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ farmId: string; batches: DetectedBatchDto[] }> {
  return apiGetJson(
    `/farms/${farmId}/cheptel/detected-batches`,
    accessToken,
    activeProfileId
  );
}

export function confirmDetectedBatch(
  accessToken: string,
  farmId: string,
  payload: {
    name: string;
    category: "starter" | "fattening";
    animalIds: string[];
    avgBirthDate?: string;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<{ batch: { id: string; name: string }; animalIds: string[] }> {
  return apiPostJson(
    `/farms/${farmId}/cheptel/detected-batches/confirm`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type WeightSeriesPointDto = {
  id: string;
  animalId: string;
  animalLabel: string;
  weightKg: number;
  measuredAt: string;
  note: string | null;
};

export function fetchCheptelWeightSeries(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  query?: { animalId?: string; months?: number }
): Promise<WeightSeriesPointDto[]> {
  const q = new URLSearchParams();
  if (query?.animalId) {
    q.set("animalId", query.animalId);
  }
  if (query?.months != null) {
    q.set("months", String(query.months));
  }
  const qs = q.toString();
  return apiGetJson<WeightSeriesPointDto[]>(
    `/farms/${farmId}/cheptel/weight-series${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export type PatchCheptelAnimalStatusPayload = PatchAnimalStatusPayload & {
  deathCause?: string;
};

export function patchCheptelAnimalStatus(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: PatchCheptelAnimalStatusPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPatchJson<AnimalDetail>(
    `/farms/${farmId}/cheptel/animals/${animalId}/status`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type SellCheptelAnimalPayload = {
  soldWeightKg: number;
  pricePerKg?: number;
  totalPrice: number;
  buyerName?: string;
  soldAt: string;
  notes?: string;
};

export type AnimalSaleTransactionDto = {
  id: string;
  amount: string | number;
  currency: string;
  label: string;
  occurredAt: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  isAutoGenerated?: boolean;
};

export type AnimalSaleResultDto = {
  animal: AnimalDetail;
  transaction: AnimalSaleTransactionDto;
};

export function sellCheptelAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: SellCheptelAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalSaleResultDto> {
  return apiPatchJson<AnimalSaleResultDto>(
    `/farms/${farmId}/cheptel/animals/${animalId}/sell`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** Réponses GET .../animals et .../batches (Prisma + includes). */
export type AnimalPenSummary = {
  placementId: string;
  penId: string;
  penName: string;
  barnId: string;
  barnName: string;
};

export type AnimalListItem = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: "male" | "female" | "unknown";
  productionCategory?:
    | "breeding_female"
    | "breeding_male"
    | "fattening"
    | "starter"
    | "unknown";
  status: string;
  healthStatus?: "healthy" | "sick" | "recovering";
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{ weightKg: string | number; measuredAt: string }>;
  currentPen: AnimalPenSummary | null;
  photoUrl?: string | null;
};

export type TaxonomyBreedDto = { id: string; name: string };
export type TaxonomySpeciesDto = {
  id: string;
  code: string;
  name: string;
  breeds: TaxonomyBreedDto[];
};

export function fetchTaxonomy(
  accessToken: string,
  activeProfileId?: string | null
): Promise<TaxonomySpeciesDto[]> {
  return apiGetJson<TaxonomySpeciesDto[]>("/taxonomy", accessToken, activeProfileId);
}

export type CreateAnimalPayload = {
  tagCode?: string;
  breedId?: string;
  sex?: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate?: string;
  ageWeeksAtEntry?: number;
  notes?: string;
  speciesId?: string;
};

export function createAnimal(
  accessToken: string,
  farmId: string,
  payload: CreateAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPostJson<AnimalDetail>(
    `/farms/${farmId}/animals`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type AnimalTagPrefixDto = "Trui" | "Ver" | "Eng" | "Dem";

export type AnimalProductionCategoryDto =
  | "breeding_female"
  | "breeding_male"
  | "fattening"
  | "starter"
  | "unknown";

export function fetchNextAnimalNumber(
  accessToken: string,
  farmId: string,
  prefix: AnimalTagPrefixDto,
  activeProfileId?: string | null
): Promise<{
  prefix: AnimalTagPrefixDto;
  tagCode: string;
  productionCategory: AnimalProductionCategoryDto;
}> {
  return apiGetJson(
    `/farms/${farmId}/next-animal-number?prefix=${encodeURIComponent(prefix)}`,
    accessToken,
    activeProfileId
  );
}


export function fetchTagCodePreview(
  accessToken: string,
  farmId: string,
  prefix: AnimalTagPrefixDto,
  count: number,
  activeProfileId?: string | null
): Promise<{
  prefix: AnimalTagPrefixDto;
  firstTagCode: string;
  lastTagCode: string;
  count: number;
  productionCategory: AnimalProductionCategoryDto;
}> {
  return apiGetJson(
    `/farms/${farmId}/next-animal-number?prefix=${encodeURIComponent(prefix)}&count=${count}`,
    accessToken,
    activeProfileId
  );
}

export type BulkCreateAnimalsPayload = {
  penId?: string;
  productionCategory: Exclude<AnimalProductionCategoryDto, "unknown">;
  count: number;
  sex?: "male" | "female" | "unknown";
  breedId?: string;
  entryWeightKg?: number;
  ageWeeksAtEntry?: number;
  entryDate: string;
  origin: AnimalOriginDto;
  supplier?: string;
  notes?: string;
};

export type BulkCreateAnimalsResult = {
  animalsCreated: Array<{ id: string; tagCode: string | null }>;
  firstNumber: string;
  lastNumber: string;
  count: number;
  placedInPenCount: number;
  unplacedCount: number;
};

export function createBulkAnimals(
  accessToken: string,
  farmId: string,
  payload: BulkCreateAnimalsPayload,
  activeProfileId?: string | null
): Promise<BulkCreateAnimalsResult> {
  return apiPostJson<BulkCreateAnimalsResult>(
    `/farms/${farmId}/animals/bulk`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type AnimalOriginDto = "farm_born" | "purchased";

export type AnimalPedigreeRef = {
  id: string;
  tagCode: string | null;
  publicId: string;
};

export type UpdateAnimalPayload = {
  tagCode?: string;
  breedId?: string | null;
  sex?: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate?: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  origin?: AnimalOriginDto | null;
  supplier?: string | null;
  photoUrl?: string | null;
  damId?: string | null;
  sireId?: string | null;
  notes?: string | null;
};

export function updateAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: UpdateAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPatchJson<AnimalDetail>(
    `/farms/${farmId}/animals/${animalId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

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
  sex: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  currentAgeWeeks?: number | null;
  origin?: AnimalOriginDto | null;
  supplier?: string | null;
  photoUrl?: string | null;
  damId?: string | null;
  sireId?: string | null;
  dam?: AnimalPedigreeRef | null;
  sire?: AnimalPedigreeRef | null;
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
  measuredAt?: string;
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
  farmId?: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  reminder?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  assignedUserId?: string | null;
  animalId?: string | null;
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
  completedBy?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  animal?: {
    id: string;
    publicId: string;
    tagCode: string | null;
    species: { id: string; code: string; name: string };
    breed: { id: string; name: string } | null;
  } | null;
};

export function fetchFarmTasks(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  status?: string,
  assignedTo?: string,
  period?: string
): Promise<FarmTaskDto[]> {
  const qs = new URLSearchParams();
  if (status && status !== "all") {
    qs.set("status", status);
  }
  if (assignedTo) {
    qs.set("assigned_to", assignedTo);
  }
  if (period) {
    qs.set("period", period);
  }
  const q = qs.toString();
  return apiGetJson<FarmTaskDto[]>(
    `/farms/${farmId}/tasks${q ? `?${q}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmTasksPendingCount(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ pendingCount: number }> {
  return apiGetJson<{ pendingCount: number }>(
    `/farms/${farmId}/tasks/summary`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  return apiGetJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}`,
    accessToken,
    activeProfileId
  );
}

export type MyTasksDashboardDto = {
  pendingCount: number;
  tasks: FarmTaskDto[];
};

export function fetchMyTasksDashboard(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period?: string
): Promise<MyTasksDashboardDto> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiGetJson<MyTasksDashboardDto>(
    `/farms/${farmId}/tasks/my-dashboard${qs}`,
    accessToken,
    activeProfileId
  );
}

export type CreateFarmTaskPayload = {
  title: string;
  description?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "pending" | "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string;
  assignedUserId?: string;
  animalId?: string;
  reminder?: "j_minus_1" | "j_zero" | "both";
};

export function createFarmTask(
  accessToken: string,
  farmId: string,
  payload: CreateFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const body = {
    ...payload,
    priority:
      payload.priority === "urgent" ? "high" : payload.priority,
    status:
      payload.status === "pending" ? "todo" : payload.status
  };
  return apiPostJson<FarmTaskDto>(
    `/farms/${farmId}/tasks`,
    body,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmTaskPayload = {
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "pending" | "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: string | null;
  completedAt?: string | null;
  assignedUserId?: string | null;
  animalId?: string | null;
  reminder?: "j_minus_1" | "j_zero" | "both" | null;
};

export function patchFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  payload: PatchFarmTaskPayload,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const body = {
    ...payload,
    priority:
      payload.priority === "urgent" ? "high" : payload.priority,
    status:
      payload.status === "pending" ? "todo" : payload.status
  };
  return apiPatchJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}`,
    body,
    accessToken,
    activeProfileId
  );
}

export function patchFarmTaskStatus(
  accessToken: string,
  farmId: string,
  taskId: string,
  status: string,
  activeProfileId?: string | null
): Promise<FarmTaskDto> {
  const mapped = status === "pending" ? "todo" : status;
  return apiPatchJson<FarmTaskDto>(
    `/farms/${farmId}/tasks/${taskId}/status`,
    { status: mapped },
    accessToken,
    activeProfileId
  );
}

export function deleteFarmTask(
  accessToken: string,
  farmId: string,
  taskId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/tasks/${taskId}`,
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

/** Santé ferme — aligné sur `FarmHealthController` (`/farms/:farmId/health/...`). */
export type FarmHealthRecordKind =
  | "vaccination"
  | "disease"
  | "vet_visit"
  | "treatment"
  | "mortality";

export type FarmHealthEntityType = "animal" | "group";

export type FarmHealthGlobalStatus = "good" | "warning" | "critical";

export type FarmHealthMonthPoint = { month: string; value: number };

export type FarmHealthOverviewDto = {
  farmId: string;
  activeDiseaseCount: number;
  overdueVaccineCount: number;
  activeTreatmentCount: number;
  globalHealthStatus: FarmHealthGlobalStatus;
  nextVaccine: {
    at: string | null;
    vaccineName: string;
    healthRecordId: string;
  } | null;
  nextVetVisitModule: {
    at: string;
    reason: string | null;
    healthRecordId: string | null;
    appointmentId: string | null;
    source: "health_record" | "vet_appointment";
    appointmentStatus: string | null;
    vetName: string | null;
  } | null;
  nextVetConsultationLegacy: {
    id: string;
    subject: string;
    openedAt: string;
  } | null;
  mortalityRate30d: string;
  charts: {
    mortalityHeadcount: FarmHealthMonthPoint[];
    diseaseNew: FarmHealthMonthPoint[];
    diseaseResolved: FarmHealthMonthPoint[];
    vaccinationsDone: FarmHealthMonthPoint[];
    vaccinationsPlanned: FarmHealthMonthPoint[];
    mortalityCauses: Array<{ cause: string; value: number }>;
  };
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
  vetAppointments: Array<{
    id: string;
    status: string;
    requestedAt: string;
    confirmedAt: string | null;
    reason: string;
    vetName: string | null;
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
    severity?: "mild" | "moderate" | "severe" | null;
    durationEstimate?: string | null;
    inIsolation?: boolean;
    treatmentOngoing?: boolean;
    resolvedAt?: string | null;
    symptoms?: { tags?: string[] } | null;
    linkedTreatmentRecordId?: string | null;
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

export function deleteFarmHealthRecord(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiDeleteJson<{ ok: true }>(
    `/farms/${farmId}/health/events/${encodeURIComponent(recordId)}`,
    accessToken,
    activeProfileId
  );
}

export function dismissFarmHealthVetVisit(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiPostJson<{ ok: true }>(
    `/farms/${farmId}/health/events/${encodeURIComponent(recordId)}/dismiss-vet-visit`,
    {},
    accessToken,
    activeProfileId
  );
}

/** DELETE avec repli POST si l'API n'expose pas encore DELETE (404). */
export async function removeFarmHealthVetVisit(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  try {
    return await deleteFarmHealthRecord(
      accessToken,
      farmId,
      recordId,
      activeProfileId
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/\b404\b|not found|introuvable|cannot delete/i.test(msg)) {
      throw err;
    }
    return dismissFarmHealthVetVisit(
      accessToken,
      farmId,
      recordId,
      activeProfileId
    );
  }
}

export type CreateDiseaseCaseBody = {
  entityType: FarmHealthEntityType;
  entityId: string;
  symptoms: string[];
  durationEstimate: string;
  estimatedOnsetDate: string;
  occurredAt?: string;
  diagnosis?: string;
  severity: "mild" | "moderate" | "severe";
  treatmentOngoing?: boolean;
  treatmentNotes?: string;
  inIsolation?: boolean;
  isolationPenId?: string;
  notes?: string;
};

export type FarmDiseasesOverviewDto = {
  farmId: string;
  kpis: {
    activeCases: number;
    resolvedThisMonth: number;
    diseaseRatePct: number;
    isolationCount: number;
  };
  pieChart: Array<{ label: string; count: number }>;
};

export type FarmDiseaseHistoryRowDto = FarmHealthRecordRowDto & {
  durationDays: number;
  treatmentLabel: string | null;
};

export function fetchFarmDiseaseHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { period?: string }
): Promise<FarmDiseaseHistoryRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.period) {
    q.set("period", filters.period);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmDiseaseHistoryRowDto[]>(
    `/farms/${farmId}/health/diseases/history${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmDiseasesOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDiseasesOverviewDto> {
  return apiGetJson<FarmDiseasesOverviewDto>(
    `/farms/${farmId}/health/diseases/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmActiveDiseaseCases(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { severity?: string; isolation?: boolean }
): Promise<FarmHealthRecordRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.severity) {
    q.set("severity", filters.severity);
  }
  if (filters?.isolation) {
    q.set("isolation", "true");
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmHealthRecordRowDto[]>(
    `/farms/${farmId}/health/diseases/active${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  body: CreateDiseaseCaseBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/diseases`,
    body,
    accessToken,
    activeProfileId
  );
}

export function resolveFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPatchJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/resolve`,
    {},
    accessToken,
    activeProfileId
  );
}

export type UpdateDiseaseCaseBody = {
  symptoms?: string[];
  diagnosis?: string;
  severity?: "mild" | "moderate" | "severe";
  durationEstimate?: string;
  treatmentOngoing?: boolean;
  inIsolation?: boolean;
  notes?: string;
};

export function updateFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  recordId: string,
  body: UpdateDiseaseCaseBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPatchJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/disease`,
    body,
    accessToken,
    activeProfileId
  );
}

export type AddDiseaseTreatmentBody = {
  drugName: string;
  dosage?: string;
  notes?: string;
};

export function addDiseaseTreatment(
  accessToken: string,
  farmId: string,
  recordId: string,
  body: AddDiseaseTreatmentBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/treatment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function declareDiseaseDeath(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/death`,
    {},
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

export type VaccineCatalogType = "viral" | "bacterial" | "antiparasitic" | "other";

export type VaccineCatalogItemDto = {
  id: string;
  code: string | null;
  name: string;
  vaccineType: VaccineCatalogType;
  targetLabel: string;
  frequency: string;
  recommendedTiming: string;
  icon: string;
  isStandard: boolean;
};

export type VaccineCoverageItemDto = {
  vaccine: VaccineCatalogItemDto;
  stats: {
    totalSubjects: number;
    upToDate: number;
    overdue: number;
    upcoming: number;
    coverageRate: number;
  };
};

export type FarmVaccineCoverageDto = {
  farmId: string;
  items: VaccineCoverageItemDto[];
};

export type VaccineSubjectStatus = "unvaccinated" | "vaccinated" | "upcoming";

export type VaccineSubjectRowDto = {
  entityType: FarmHealthEntityType;
  entityId: string;
  label: string;
  categoryLabel: string;
  penLabel: string | null;
  headcount: number;
  status: VaccineSubjectStatus;
  lastVaccinationAt: string | null;
  nextDueAt: string | null;
};

export type FarmVaccineSubjectsDto = {
  farmId: string;
  vaccineId: string;
  status: VaccineSubjectStatus;
  subjects: VaccineSubjectRowDto[];
};

export type CreateVaccineRecordsBody = {
  vaccineId: string;
  subjects: Array<{ entityType: FarmHealthEntityType; entityId: string }>;
  administeredDate?: string;
  nextDueDate?: string;
  practitioner?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
};

export type CreateCustomVaccineBody = {
  name: string;
  vaccineType: VaccineCatalogType;
  targetCategories: string[];
  targetLabel: string;
  frequency: string;
  recommendedTiming: string;
  icon?: string;
  notes?: string;
};

export function fetchFarmVaccineCoverage(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmVaccineCoverageDto> {
  return apiGetJson<FarmVaccineCoverageDto>(
    `/farms/${farmId}/vaccines/coverage`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmVaccineSubjects(
  accessToken: string,
  farmId: string,
  vaccineId: string,
  status: VaccineSubjectStatus,
  activeProfileId?: string | null
): Promise<FarmVaccineSubjectsDto> {
  return apiGetJson<FarmVaccineSubjectsDto>(
    `/farms/${farmId}/vaccines/${encodeURIComponent(vaccineId)}/subjects?status=${encodeURIComponent(status)}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmVaccineRecords(
  accessToken: string,
  farmId: string,
  body: CreateVaccineRecordsBody,
  activeProfileId?: string | null
): Promise<{ farmId: string; vaccineId: string; createdCount: number; recordIds: string[] }> {
  return apiPostJson(
    `/farms/${farmId}/vaccines/records`,
    body,
    accessToken,
    activeProfileId
  );
}

export function createFarmCustomVaccine(
  accessToken: string,
  farmId: string,
  body: CreateCustomVaccineBody,
  activeProfileId?: string | null
): Promise<VaccineCatalogItemDto> {
  return apiPostJson<VaccineCatalogItemDto>(
    `/farms/${farmId}/vaccines/custom`,
    body,
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

export type CreateFarmExpenseResponse = FarmExpenseDto & {
  reconciliation?: ReconciliationOfferDto | null;
};

export function createFarmExpense(
  accessToken: string,
  farmId: string,
  payload: CreateFarmExpensePayload,
  activeProfileId?: string | null
): Promise<CreateFarmExpenseResponse> {
  return apiPostJson<CreateFarmExpenseResponse>(
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

export type LinkedStockMovementSummaryDto = {
  id: string;
  feedTypeId: string;
  feedTypeName: string;
  quantityKg: string | null;
  unitPrice: string | null;
  supplier: string | null;
  occurredAt: string;
};

export type LinkedStockForExpenseDto = {
  expenseId: string;
  movements: LinkedStockMovementSummaryDto[];
};

/** GET /farms/:farmId/finance/expenses/:expenseId/linked-stock */
export function fetchLinkedStockForExpense(
  accessToken: string,
  farmId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<LinkedStockForExpenseDto> {
  return apiGetJson<LinkedStockForExpenseDto>(
    `/farms/${farmId}/finance/expenses/${expenseId}/linked-stock`,
    accessToken,
    activeProfileId
  );
}

export type LinkedTransactionForMovementDto = {
  movementId: string;
  expense: {
    id: string;
    amount: string;
    currency: string;
    label: string;
    occurredAt: string;
    categoryKey: string | null;
  } | null;
};

/** GET /farms/:farmId/feed/movements/:movementId/linked-transaction */
export function fetchLinkedTransactionForMovement(
  accessToken: string,
  farmId: string,
  movementId: string,
  activeProfileId?: string | null
): Promise<LinkedTransactionForMovementDto> {
  return apiGetJson<LinkedTransactionForMovementDto>(
    `/farms/${farmId}/feed/movements/${movementId}/linked-transaction`,
    accessToken,
    activeProfileId
  );
}

/** DELETE /farms/:farmId/finance/expenses/:expenseId/with-stock */
export function deleteFarmExpenseWithStock(
  accessToken: string,
  farmId: string,
  expenseId: string,
  deleteStock: boolean,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  const q = deleteStock ? "?deleteStock=true" : "?deleteStock=false";
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/expenses/${expenseId}/with-stock${q}`,
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
  /** Série mensuelle sur les 6 derniers mois (revenus / dépenses). */
  months6: FinanceOverviewMonthPoint[];
  /** @deprecated Utiliser months6 — 3 derniers mois seulement. */
  months3?: FinanceOverviewMonthPoint[];
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
  isAutoGenerated?: boolean;
  linkedStockMovementIds?: string[];
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

export function createFinanceCategory(
  accessToken: string,
  farmId: string,
  payload: {
    type: "income" | "expense";
    key: string;
    name: string;
    icon?: string | null;
  },
  activeProfileId?: string | null
): Promise<FinanceCategoryDto> {
  return apiPostJson<FinanceCategoryDto>(
    `/farms/${farmId}/finance/categories`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteFinanceCategory(
  accessToken: string,
  farmId: string,
  categoryId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/finance/categories/${categoryId}`,
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

export type FarmBudgetLineDto = {
  budgetLineId: string | null;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  categoryIcon: string | null;
  amountPlanned: string;
  amountRealized: string;
  amountProjected: string;
  consumptionPct: number;
  projectedConsumptionPct: number;
  remaining: string;
  status: "ok" | "warning" | "exceeded";
  projectedStatus: "ok" | "warning" | "exceeded";
  currency: string;
};

export type FarmBudgetGlobalDto = {
  totalPlanned: string;
  totalRealized: string;
  totalProjected: string;
  remaining: string;
  consumptionPct: number;
  status: "on_track" | "warning" | "exceeded";
  deltaProjected: string;
  projectedEndOfMonth: string;
};

export type FarmBudgetSuggestionDto = {
  id: string;
  type: string;
  message: string;
  actionPayload: Record<string, unknown> | null;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
};

export type FarmBudgetViewDto = {
  farmId: string;
  year: number;
  month: number;
  configured: boolean;
  budgetId: string | null;
  currency: string;
  currencySymbol: string;
  createdFrom: string | null;
  global: FarmBudgetGlobalDto;
  lines: FarmBudgetLineDto[];
  suggestions: FarmBudgetSuggestionDto[];
};

export type FarmBudgetCategoryHistoryDto = {
  categoryId: string;
  points: Array<{ year: number; month: number; expenses: string }>;
  averageExpenses: string;
};

export type FarmBudgetSimulateDto = {
  categoryId: string;
  newAmount: string;
  global: FarmBudgetGlobalDto & {
    previousTotalPlanned: string;
    marginAvailable: string;
  };
  lines: FarmBudgetLineDto[];
};

export function fetchFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function upsertFarmBudget(
  accessToken: string,
  farmId: string,
  payload: {
    year: number;
    month: number;
    lines: Array<{ categoryId: string; amountPlanned: number }>;
    createdFrom?: "manual" | "copied" | "auto_suggested";
  },
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function copyPreviousFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/copy-previous?${qs.toString()}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function applyAutoFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/suggestion-auto?${qs.toString()}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function updateFarmBudgetLine(
  accessToken: string,
  farmId: string,
  lineId: string,
  amountPlanned: number,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPutJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget-lines/${lineId}`,
    { amountPlanned },
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBudgetCategoryHistory(
  accessToken: string,
  farmId: string,
  categoryId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<FarmBudgetCategoryHistoryDto> {
  const qs = new URLSearchParams();
  qs.set("categoryId", categoryId);
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<FarmBudgetCategoryHistoryDto>(
    `/farms/${farmId}/finance/budget/category-history?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function simulateFarmBudget(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  categoryId: string,
  newAmount: number,
  activeProfileId?: string | null
): Promise<FarmBudgetSimulateDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  qs.set("categoryId", categoryId);
  qs.set("newAmount", String(newAmount));
  return apiGetJson<FarmBudgetSimulateDto>(
    `/farms/${farmId}/finance/budget/simulate?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type BudgetAiRecommendation = {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
  suggestedBudget: number;
  savings: number;
  action: string;
  justification: string;
};

export type BudgetAiAnalysisDto = {
  analysis: string;
  recommendations: BudgetAiRecommendation[];
  totalSavingsEstimate: number;
  aiPowered?: boolean;
};

export function fetchBudgetAiAnalysis(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  activeProfileId?: string | null
): Promise<BudgetAiAnalysisDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiGetJson<BudgetAiAnalysisDto>(
    `/farms/${farmId}/finance/budget/ai-analysis?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function applyBudgetAiRecommendations(
  accessToken: string,
  farmId: string,
  year: number,
  month: number,
  items: Array<{ categoryId: string; suggestedBudget: number }>,
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  const qs = new URLSearchParams();
  qs.set("year", String(year));
  qs.set("month", String(month));
  return apiPostJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget/ai-analysis/apply?${qs.toString()}`,
    { items },
    accessToken,
    activeProfileId
  );
}

export function patchFarmBudgetSuggestion(
  accessToken: string,
  farmId: string,
  suggestionId: string,
  payload: { apply?: boolean; dismiss?: boolean },
  activeProfileId?: string | null
): Promise<FarmBudgetViewDto> {
  return apiPatchJson<FarmBudgetViewDto>(
    `/farms/${farmId}/finance/budget-suggestions/${suggestionId}`,
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
  category?: string | null;
  photoUrls?: string[] | null;
  /** Photo cheptel si photoUrls vide (API). */
  fallbackPhotoUrl?: string | null;
  animalIds?: string[] | null;
  totalWeightKg?: string | number | null;
  pricePerKg?: string | number | null;
  totalPrice?: string | number | null;
  breedLabel?: string | null;
  viewsCount?: number;
  consultationsCount?: number;
  expiresAt?: string | null;
  activeOfferCount?: number;
  /** Vendeur accepte les offres à crédit (charcutier). */
  creditEnabled?: boolean;
  farm: { id: string; name: string } | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    photoUrl?: string | null;
  } | null;
  seller?: { id: string; fullName: string | null };
};

export function fetchMarketplaceListings(
  accessToken: string,
  activeProfileId?: string | null,
  opts?: { mine?: boolean; status?: string; category?: string; q?: string }
): Promise<MarketplaceListingListItem[]> {
  const qs = new URLSearchParams();
  if (opts?.mine) {
    qs.set("mine", "true");
  }
  if (opts?.status) {
    qs.set("status", opts.status);
  }
  if (opts?.category) {
    qs.set("category", opts.category);
  }
  if (opts?.q?.trim()) {
    qs.set("q", opts.q.trim());
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
  proposedPricePerKg?: string | number | null;
  counterPricePerKg?: string | number | null;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  buyer?: { id: string; fullName: string | null; email: string | null };
};

export type MarketplaceListingHealthVaccine = {
  vaccineName: string;
  administeredDate: string;
  nextDueDate: string | null;
  status: "done" | "upcoming" | "overdue";
  animalId: string;
  animalLabel: string;
};

export type MarketplaceListingPastDisease = {
  diagnosis: string | null;
  symptomsSummary: string;
  onsetDate: string;
  resolvedDate: string;
  durationDays: number;
  finalStatus: "recovered" | "resolved";
  animalId: string;
  animalLabel: string;
};

export type MarketplaceListingHealthData = {
  vaccines: MarketplaceListingHealthVaccine[];
  pastDiseases: MarketplaceListingPastDisease[];
  activeCasesCount: number;
  vaccinesStatus: "up_to_date" | "overdue" | "none";
};

export type MarketplaceListingFarmInfo = {
  farmId: string;
  farmName: string;
  farmLocation: string | null;
  producerDisplayName: string;
  farmRating: number | null;
  farmRatingCount: number;
  farmTotalSales: number;
  activeListingsCount: number;
};

export type MarketplaceListingDetail = MarketplaceListingListItem & {
  sellerUserId: string;
  seller: {
    id: string;
    fullName: string | null;
    email?: string | null;
    sellerDisplayName?: string;
  };
  myOffers?: MarketplaceOfferBrief[];
  offers?: MarketplaceOfferBrief[];
  healthData?: MarketplaceListingHealthData | null;
  farmInfo?: MarketplaceListingFarmInfo | null;
  farmRatingSummary?: { avg: number | null; count: number } | null;
};

/** @deprecated Utiliser `healthData` sur le détail annonce. */
export type MarketplaceListingHealthSnapshot = {
  vaccinesUpToDate: boolean;
  lastVaccinationAt: string | null;
  lastVetVisitAt: string | null;
  lastVetReason: string | null;
  recentDiseaseSummary: string | null;
  mortalityRate30dPct: string;
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

/** POST — incrémente les vues (hors vendeur). */
export function postMarketplaceListingView(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean; viewsCount: number }> {
  return apiPostJson<{ ok: boolean; viewsCount: number }>(
    `/marketplace/listings/${listingId}/view`,
    {},
    accessToken,
    activeProfileId
  );
}

/** POST — incrémente les consultations (hors vendeur). */
export function postMarketplaceListingConsult(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean; consultationsCount: number }> {
  return apiPostJson<{ ok: boolean; consultationsCount: number }>(
    `/marketplace/listings/${listingId}/consult`,
    {},
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

/** POST — vendeur : conclut la vente (Cheptel + Finance atomiques). */
export type CompleteMarketplaceHandoverPayload = {
  offerId: string;
  soldWeightKg: number;
  totalPrice: number;
  soldAt?: string;
  notes?: string;
};

export function completeMarketplaceHandover(
  accessToken: string,
  listingId: string,
  payload: CompleteMarketplaceHandoverPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/complete-handover`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PostMarketplaceOfferPayload = {
  offeredPrice?: number;
  proposedPricePerKg?: number;
  quantity?: number;
  message?: string;
  buyerFarmId?: string;
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

export type BuyerCreditScoreDto = {
  score: string;
  emoji: string;
  label: string;
  color: string;
  blocked: boolean;
  creditTransactionsCount: number;
  creditOnTimeCount: number;
  creditLateCount: number;
  creditDefaultCount: number;
};

export type MarketplaceCreditOfferDto = {
  id: string;
  listingId: string;
  listingTitle: string;
  currency: string;
  offerType: string;
  status: string;
  offeredPrice: number;
  advancePercentage: number | null;
  advanceAmount: number | null;
  balanceAmount: number | null;
  balanceDueDays: number | null;
  balanceDueAt: string | null;
  message: string | null;
  buyerCreditScore: BuyerCreditScoreDto | null;
  transactionId?: string | null;
};

export function fetchMyCreditScore(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerCreditScoreDto> {
  return apiGetJson<BuyerCreditScoreDto>(
    "/marketplace/buyers/me/credit-score",
    accessToken,
    activeProfileId
  );
}

export function postMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  payload: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
    message?: string;
    buyerFarmId?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPostJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/credit`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function agreeMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`,
    {},
    accessToken,
    activeProfileId
  );
}

export function counterMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  payload: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/${offerId}/counter-credit`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function initiateMarketplaceCreditBalancePayment(
  accessToken: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<{
  providerRef: string;
  amount: number;
  currency: string;
  transactionId: string;
}> {
  return apiPostJson(
    `/marketplace/offers/${offerId}/balance-payment/initiate`,
    {},
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceCreditBalancePayment(
  accessToken: string,
  offerId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/balance-payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceAdvancePaid(
  accessToken: string,
  offerId: string,
  payload: { paymentMode: string; paymentRef?: string },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-advance-paid`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceAdvanceReceived(
  accessToken: string,
  offerId: string,
  received: boolean,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-advance-received`,
    { received },
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceBalancePaid(
  accessToken: string,
  offerId: string,
  payload: { amount: number; paymentMode: string; paymentRef?: string },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-balance-paid`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceBalanceReceived(
  accessToken: string,
  offerId: string,
  received: boolean,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-balance-received`,
    { received },
    accessToken,
    activeProfileId
  );
}

export type CreditPendingRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  currency: string;
  balanceAmount: number;
  balanceDueAt: string | null;
  status: string;
  buyerName: string | null;
};

export function fetchCreditPendingOffers(
  accessToken: string,
  farmId?: string | null,
  activeProfileId?: string | null
): Promise<CreditPendingRow[]> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<CreditPendingRow[]>(
    `/marketplace/offers/credit-pending${qs}`,
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferCreditFields = {
  offerType?: string | null;
  advancePercentage?: number | null;
  advanceAmount?: string | number | null;
  balanceAmount?: string | number | null;
  balanceDueDays?: number | null;
  balanceDueAt?: string | null;
  advancePaidDeclaredAt?: string | null;
  advanceConfirmedAt?: string | null;
  balancePaidDeclaredAt?: string | null;
  balanceConfirmedAt?: string | null;
  deliveredAt?: string | null;
  buyerCreditScore?: BuyerCreditScoreDto | null;
};

export type MarketplaceOfferMineRow = MarketplaceOfferCreditFields & {
  id: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  transaction?: { id: string } | null;
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

export type MarketplaceOfferReceivedRow = MarketplaceOfferCreditFields & {
  id: string;
  offeredPrice: string | number;
  proposedPricePerKg?: string | number | null;
  counterPricePerKg?: string | number | null;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  buyer: { id: string; fullName: string | null; email: string | null };
  listing: {
    id: string;
    title: string;
    status: string;
    currency: string;
    category: string | null;
    totalWeightKg: string | number | null;
    pricePerKg?: string | number | null;
    totalPrice?: string | number | null;
    farm: { id: string; name: string } | null;
    animal: { id: string; publicId: string; tagCode: string | null } | null;
  };
};

export type MarketplaceOfferCounts = {
  receivedPending: number;
  sentPending: number;
  total: number;
};

/** GET /marketplace/offers/received — propositions sur mes annonces. */
export function fetchReceivedMarketplaceOffers(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string | null
): Promise<MarketplaceOfferReceivedRow[]> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<MarketplaceOfferReceivedRow[]>(
    `/marketplace/offers/received${qs}`,
    accessToken,
    activeProfileId
  );
}

/** GET /marketplace/offers/counts — badges propositions. */
export function fetchMarketplaceOfferCounts(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string | null
): Promise<MarketplaceOfferCounts> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<MarketplaceOfferCounts>(
    `/marketplace/offers/counts${qs}`,
    accessToken,
    activeProfileId
  );
}

/** Réponse acceptation offre (vendeur ou acheteur contre-proposition). */
export type MarketplaceAcceptOfferResponse = {
  transactionId: string;
};

/** Vendeur : accepter une offre (crée la transaction escrow). */
export function acceptMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceAcceptOfferResponse> {
  return apiPostJson<MarketplaceAcceptOfferResponse>(
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

/** Vendeur : contre-proposition (prix/kg). */
export function counterMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  payload: {
    counterPricePerKg?: number;
    counterOfferedPrice?: number;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/listings/${listingId}/offers/${offerId}/counter`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** Acheteur : accepte une contre-proposition. */
export function acceptMarketplaceOfferCounter(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceAcceptOfferResponse> {
  return apiPostJson<MarketplaceAcceptOfferResponse>(
    `/marketplace/listings/${listingId}/offers/${offerId}/accept-counter`,
    {},
    accessToken,
    activeProfileId
  );
}

export type MarketplacePendingTransferDto = {
  id: string;
  transactionId: string;
  buyerFarmId: string | null;
  animalIds: string[];
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type MarketplaceTransactionDto = {
  id: string;
  listingId: string;
  offerId: string;
  buyerUserId: string;
  sellerUserId: string;
  status: string;
  priceType: string;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
  blockedAmount: number;
  finalAmount: number | null;
  realWeightKg: number | null;
  pickupDate: string | null;
  pickupLocation: string | null;
  sellerShippedAt?: string | null;
  shipmentMethod?: string | null;
  shipmentNotes?: string | null;
  buyerReceivedAt?: string | null;
  receiptCondition?: string | null;
  receiptNotes?: string | null;
  receivedAnimalIds?: string[];
  listingStatus?: string | null;
  listingAnimalIds?: string[];
  currency: string;
  offerExpiresAt: string;
  listingTitle: string | null;
  receiptGenerationStatus?: string;
  receipt?: {
    id: string;
    receiptNumber: string;
    generatedAt: string;
  } | null;
  pendingTransfer?: MarketplacePendingTransferDto | null;
  isCredit?: boolean;
};

export type MarketplaceReceiptDto = {
  receiptNumber: string | null;
  generatedAt: string | null;
  downloadUrl: string | null;
  status: string;
};

export type MarketplaceFinanceSummaryDto = {
  blockedFunds: number;
  pendingRevenue: number;
  totalSpent: number;
  confirmedRevenue: number;
  currency: string;
  blockedTransactions: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    agreedAmount: number;
    blockedAmount: number;
    status: string;
    sellerName: string | null;
  }>;
  pendingTransactions: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    agreedAmount: number;
    blockedAmount: number;
    status: string;
    buyerName: string | null;
  }>;
  monthlySeries: Array<{
    month: string;
    confirmedRevenue: number;
    pendingRevenue: number;
    confirmedSpent: number;
    blockedFunds: number;
  }>;
};

export type MarketplacePartnerDto = {
  partnerKey: string;
  userId: string | null;
  displayName: string;
  subtitle: string | null;
  transactionCount: number;
  closedCount: number;
  marketplaceCount: number;
  directSaleCount: number;
  lastTransactionAt: string;
};

export function fetchMarketplacePartners(
  accessToken: string,
  role: "seller" | "buyer",
  activeProfileId?: string | null
): Promise<MarketplacePartnerDto[]> {
  return apiGetJson<MarketplacePartnerDto[]>(
    `/marketplace/transactions/partners?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransactions(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto[]> {
  return apiGetJson<MarketplaceTransactionDto[]>(
    "/marketplace/transactions",
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransactionSummary(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceFinanceSummaryDto> {
  return apiGetJson<MarketplaceFinanceSummaryDto>(
    "/marketplace/transactions/summary",
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransaction(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiGetJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}`,
    accessToken,
    activeProfileId
  );
}

export function initiateMarketplacePayment(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<{ providerRef: string; amount: number; currency: string }> {
  return apiPostJson<{ providerRef: string; amount: number; currency: string }>(
    `/marketplace/transactions/${transactionId}/payment/initiate`,
    {},
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplacePayment(
  accessToken: string,
  transactionId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function scheduleMarketplacePickup(
  accessToken: string,
  transactionId: string,
  payload: { pickupDate: string; pickupLocation: string; notes?: string },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/pickup`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceShipment(
  accessToken: string,
  transactionId: string,
  payload: {
    shippedAt: string;
    method?: "handover" | "third_party" | "seller_delivery";
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/confirm-shipment`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceReceipt(
  accessToken: string,
  transactionId: string,
  payload: {
    receivedAt: string;
    condition: "conform" | "minor_issue" | "major_issue";
    receivedAnimalIds: string[];
    realWeightKg?: number;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/confirm-receipt`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  realWeightKg: number,
  activeProfileId?: string | null,
  photoUrl?: string
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/declare`,
    { realWeightKg, photoUrl },
    accessToken,
    activeProfileId
  );
}

export function validateMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/validate`,
    {},
    accessToken,
    activeProfileId
  );
}

export function disputeMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  reason: string | undefined,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/dispute`,
    reason ? { reason } : {},
    accessToken,
    activeProfileId
  );
}

export function cancelMarketplaceTransaction(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/cancel`,
    {},
    accessToken,
    activeProfileId
  );
}

export function completeMarketplacePendingTransfer(
  accessToken: string,
  transactionId: string,
  payload: { buyerFarmId: string; penId?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean; animalIds: string[] }> {
  return apiPostJson<{ ok: boolean; animalIds: string[] }>(
    `/marketplace/transactions/${transactionId}/pending-transfer/complete`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceReceipt(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceReceiptDto> {
  return apiGetJson<MarketplaceReceiptDto>(
    `/marketplace/transactions/${transactionId}/receipt`,
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
  category?: string;
  photoUrls?: string[];
  animalIds?: string[];
  totalWeightKg?: number;
  pricePerKg?: number;
  totalPrice?: number;
  breedLabel?: string;
  creditEnabled?: boolean;
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
  category?: string | null;
  photoUrls?: string[];
  animalIds?: string[];
  totalWeightKg?: number | null;
  pricePerKg?: number | null;
  totalPrice?: number | null;
  breedLabel?: string | null;
  creditEnabled?: boolean;
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
  activeProfileId?: string | null,
  durationDays?: 7 | 14 | 30
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/publish`,
    durationDays ? { durationDays } : {},
    accessToken,
    activeProfileId
  );
}

export function renewMarketplaceListing(
  accessToken: string,
  listingId: string,
  durationDays: 7 | 14 | 30,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/renew`,
    { durationDays },
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

export type VetSearchItemDto = {
  id: string;
  fullName: string;
  primarySpecialty: string;
  locationLabel: string;
  profilePhotoUrl: string | null;
  availability: boolean;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  distanceKm: number | null;
};

export type VetSearchResponseDto = {
  items: VetSearchItemDto[];
};

export type VetPublicProfileDto = {
  id: string;
  /** userId de l'utilisateur vétérinaire (pour ouvrir un chat direct). */
  userId: string;
  fullName: string;
  primarySpecialty: string;
  otherSpecialties: string[];
  locationLabel: string;
  professionalPhone: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  profilePhotoUrl: string | null;
  bio: string | null;
  availability: boolean;
  interventionRadiusKm: number | null;
  verificationStatus: VetVerificationStatus;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  stats: {
    farmsFollowed: number;
    visitsCompleted: number;
    completedAppointments?: number;
  };
  servicePriceRange?: {
    min: number;
    max: number;
    currency: string;
  } | null;
  recentReviews: Array<{
    score: number;
    comment: string | null;
    authorName: string | null;
    createdAt: string;
    tags?: string[];
  }>;
  canContact: boolean;
  isSelf: boolean;
};

export type UpsertVetProfileBody = {
  fullName: string;
  orderNumber: string;
  primarySpecialty: string;
  otherSpecialties?: string[];
  locationCity: string;
  locationCountry: string;
  professionalPhone: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  diplomaPhotoUrl: string;
  profilePhotoUrl?: string;
  bio?: string;
  availability?: boolean;
  interventionRadiusKm?: number;
};

export function searchVets(
  accessToken: string,
  params: {
    q?: string;
    specialty?: string;
    rating?: string;
    available?: boolean;
    lat?: number;
    lng?: number;
  },
  activeProfileId?: string | null
): Promise<VetSearchResponseDto> {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.specialty) q.set("specialty", params.specialty);
  if (params.rating) q.set("rating", params.rating);
  if (params.available) q.set("available", "true");
  if (params.lat != null) q.set("lat", String(params.lat));
  if (params.lng != null) q.set("lng", String(params.lng));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<VetSearchResponseDto>(
    `/vets/search${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetPublicProfile(
  accessToken: string,
  vetId: string,
  activeProfileId?: string | null
): Promise<VetPublicProfileDto> {
  return apiGetJson<VetPublicProfileDto>(
    `/vets/${encodeURIComponent(vetId)}/profile`,
    accessToken,
    activeProfileId
  );
}

export function upsertVetProfile(
  accessToken: string,
  body: UpsertVetProfileBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson("/vet-profiles", body, accessToken, activeProfileId);
}

export type VetDashboardDto = {
  kpis: {
    farmsFollowed: number;
    visitsThisMonth: number;
    healthAlerts: number;
    pendingTasks: number;
  };
  upcomingVisits: Array<{
    id: string;
    farmId: string;
    farmName: string;
    producerName: string | null;
    producerPhone: string | null;
    scheduledAt: string;
    subject: string;
    location: string | null;
    status: string;
    kind?: "consultation" | "appointment";
    conflictStatus?: string | null;
    conflictLabel?: string | null;
    servicePrice?: number | null;
  }>;
  assignedFarms: Array<{
    id: string;
    name: string;
    address: string | null;
    producerName: string | null;
    producerPhone: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    kind: "consultation" | "vet_visit" | "vaccination" | "disease" | "treatment" | "alert";
    title: string;
    subtitle: string;
    occurredAt: string;
    farmId: string;
    farmName: string;
  }>;
  stats: {
    farmsFollowed: number;
    visitsCompleted: number;
    averageRating: number | null;
  };
};

export function fetchVetDashboard(
  accessToken: string,
  activeProfileId?: string | null
): Promise<VetDashboardDto> {
  return apiGetJson("/vet-profiles/me/dashboard", accessToken, activeProfileId);
}

export function fetchVetProfileMe(
  accessToken: string,
  activeProfileId?: string | null
): Promise<VetPublicProfileDto> {
  return apiGetJson("/vet-profiles/me", accessToken, activeProfileId);
}

export type VetVisitReason =
  | "routine"
  | "urgency"
  | "followup"
  | "vaccination"
  | "other";

export type ScheduleVetVisitPayload = {
  farmId: string;
  scheduledAt: string;
  reason: VetVisitReason;
  notes?: string;
  consultationPrice?: number;
};

export type ScheduleVetVisitResult = {
  id: string;
  farmId: string;
  farmName?: string | null;
  scheduledAt: string;
  requestedAt?: string;
  subject?: string;
  reason?: string;
  status: string;
  vetName?: string | null;
};

export function scheduleVetVisit(
  accessToken: string,
  activeProfileId: string | null | undefined,
  payload: ScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  const { farmId, ...body } = payload;
  return apiPostJson(
    `/farms/${encodeURIComponent(farmId)}/vet-appointments/schedule-from-vet`,
    body,
    accessToken,
    activeProfileId
  );
}

export type VetAvailabilitySlotDto = {
  time: string;
  status: "available" | "occupied" | "unavailable";
};

export type VetAvailabilityDto = {
  vetProfileId: string;
  date: string;
  vetAvailable: boolean;
  slots: VetAvailabilitySlotDto[];
};

export function fetchVetAvailability(
  accessToken: string,
  vetProfileId: string,
  dateIso: string,
  activeProfileId?: string | null
): Promise<VetAvailabilityDto> {
  const q = new URLSearchParams({ date: dateIso });
  return apiGetJson<VetAvailabilityDto>(
    `/vets/${encodeURIComponent(vetProfileId)}/availability?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type ProducerScheduleVetVisitPayload = {
  vetProfileId: string;
  scheduledAt: string;
  reason: VetVisitReason;
  notes?: string;
};

export function requestVetAppointment(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  payload: ProducerScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  return apiPostJson(
    `/farms/${encodeURIComponent(farmId)}/vet-appointments`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** @deprecated Préférer requestVetAppointment — alias conservé pour compatibilité. */
export function scheduleVetVisitFromProducer(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  payload: ProducerScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  return requestVetAppointment(accessToken, farmId, activeProfileId, payload);
}

export type VetAppointmentDto = {
  id: string;
  farmId: string;
  farmName?: string | null;
  farmLocation?: string | null;
  producerUserId: string;
  producerName?: string | null;
  vetProfileId: string;
  vetUserId: string;
  vetName?: string | null;
  status: string;
  requestedAt: string;
  scheduledAt?: string;
  confirmedAt?: string | null;
  estimatedDurationHours: number;
  reason: string;
  notes?: string | null;
  refusalReason?: string | null;
  vetResponseNotes?: string | null;
  servicePrice?: number | null;
  blockedAmount?: number | null;
  paymentDeadline?: string | null;
  paymentConfirmedAt?: string | null;
  completedAt?: string | null;
  conflictStatus?: string | null;
  conflictLabel?: string | null;
  currency: string;
  rating?: { rating: number; comment?: string | null; tags?: string[] } | null;
  requiresRating?: boolean;
};

export type VetAppointmentFinanceSummaryDto = {
  role: "producer" | "vet";
  pendingEarnings: number;
  confirmedEarnings: number;
  blockedForAppointments: number;
  currency: string;
  pendingAppointments?: Array<{
    id: string;
    farmName: string;
    producerName: string | null;
    amount: number;
    status: string;
    confirmedAt: string | null;
  }>;
  blockedAppointments?: Array<{
    id: string;
    farmName: string;
    vetName: string;
    amount: number;
    status: string;
    confirmedAt: string | null;
  }>;
};

export function fetchVetAppointmentFinanceSummary(
  accessToken: string,
  role: "producer" | "vet",
  activeProfileId?: string | null
): Promise<VetAppointmentFinanceSummaryDto> {
  return apiGetJson(
    `/vet-appointments/summary?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetAppointments(
  accessToken: string,
  role: "producer" | "vet",
  activeProfileId?: string | null
): Promise<VetAppointmentDto[]> {
  return apiGetJson(
    `/vet-appointments/me?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetAppointment(
  accessToken: string,
  appointmentId: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiGetJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}`,
    accessToken,
    activeProfileId
  );
}

export function vetAcceptAppointment(
  accessToken: string,
  appointmentId: string,
  payload: { servicePrice: number; confirmedAt?: string; notes?: string },
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/accept`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function vetRefuseAppointment(
  accessToken: string,
  appointmentId: string,
  refusalReason?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/refuse`,
    refusalReason ? { refusalReason } : {},
    accessToken,
    activeProfileId
  );
}

export function initiateVetAppointmentPayment(
  accessToken: string,
  appointmentId: string,
  activeProfileId?: string | null
): Promise<{ providerRef: string; amount: number; currency: string }> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/payment/initiate`,
    {},
    accessToken,
    activeProfileId
  );
}

export function confirmVetAppointmentPayment(
  accessToken: string,
  appointmentId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function completeVetAppointmentService(
  accessToken: string,
  appointmentId: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto & { requiresRating?: boolean }> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/complete`,
    {},
    accessToken,
    activeProfileId
  );
}

export function submitVetAppointmentRating(
  accessToken: string,
  appointmentId: string,
  payload: { rating: number; comment?: string; tags?: string[] },
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/rating`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function cancelVetAppointment(
  accessToken: string,
  appointmentId: string,
  reason?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/cancel`,
    reason ? { reason } : {},
    accessToken,
    activeProfileId
  );
}

export type VetVisitQuoteDto = {
  id: string;
  scheduledAt: string;
  vetName: string;
  reason: unknown;
  visitQuoteStatus: string;
  consultationPrice: number | null;
  counterPrice: number | null;
  notes: string | null;
};

export function fetchVetVisitQuotes(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<VetVisitQuoteDto[]> {
  return apiGetJson(
    `/farms/${farmId}/vet-visit-quotes`,
    accessToken,
    activeProfileId
  );
}

export function respondVetVisitQuote(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: { action: "accept" | "refuse" | "counter"; counterPrice?: number },
  activeProfileId?: string | null
): Promise<{ id: string; visitQuoteStatus: string }> {
  return apiPostJson(
    `/farms/${farmId}/vet-visit-quotes/${consultationId}/respond`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function createVetRating(
  accessToken: string,
  vetId: string,
  body: { score: number; comment?: string; ratedByFarmId?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson(
    `/vet-ratings/${encodeURIComponent(vetId)}`,
    body,
    accessToken,
    activeProfileId
  );
}

export type OnboardingStatusDto = {
  isOnboarded: boolean;
  onboardingSkipped: boolean;
};

export type CompleteOnboardingPayload = {
  farmName: string;
  speciesFocus?: string;
  locationSource: "gps" | "manual";
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  femaleBreeders: number;
  maleBreeders: number;
  starterHeadcount: number;
  fatteningHeadcount: number;
  buildingsCount: number;
  pensPerBuilding: number;
  maxPigsPerPen: number;
  productionEstimatedAgeWeeks?: number;
};

export type CompleteOnboardingResult = OnboardingStatusDto & {
  farm: { id: string; name: string };
};

export function fetchOnboardingStatus(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiGetJson<OnboardingStatusDto>(
    "/onboarding/status",
    accessToken,
    activeProfileId
  );
}

export function postOnboardingComplete(
  accessToken: string,
  payload: CompleteOnboardingPayload,
  activeProfileId?: string | null
): Promise<CompleteOnboardingResult> {
  return apiPostJson<CompleteOnboardingResult>(
    "/onboarding/complete",
    payload,
    accessToken,
    activeProfileId
  );
}

export function postOnboardingSkip(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiPostJson<OnboardingStatusDto>(
    "/onboarding/skip",
    {},
    accessToken,
    activeProfileId
  );
}

/** Période rapport ferme (Prisma `ReportPeriodType`). */
export type FarmReportPeriodType = "monthly" | "quarterly" | "yearly";

export type FarmReportPreviewDto = {
  farmId: string;
  periodType: FarmReportPeriodType;
  period: { start: string; end: string };
  score: {
    global: number;
    band: string;
    breakdown: Record<string, { score: number; detail: string }>;
  };
  sections: Record<string, unknown>;
};

export function fetchFarmReportPreview(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params: {
    periodType: FarmReportPeriodType;
    year: number;
    month?: number;
    quarter?: number;
  }
): Promise<FarmReportPreviewDto> {
  const q = new URLSearchParams();
  q.set("periodType", params.periodType);
  q.set("year", String(params.year));
  if (params.month != null) {
    q.set("month", String(params.month));
  }
  if (params.quarter != null) {
    q.set("quarter", String(params.quarter));
  }
  return apiGetJson<FarmReportPreviewDto>(
    `/farms/${farmId}/reports/preview?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type FarmScoreDto = {
  farmId: string;
  scoreGlobal: number;
  scoreBreakdown: Record<string, { score: number; detail: string }>;
  band: string;
};

export function fetchFarmScore(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params?: { year?: number; month?: number }
): Promise<FarmScoreDto> {
  const q = new URLSearchParams();
  if (params?.year != null) {
    q.set("year", String(params.year));
  }
  if (params?.month != null) {
    q.set("month", String(params.month));
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmScoreDto>(
    `/farms/${farmId}/score${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type FarmReportListItemDto = {
  id: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  contentHash: string | null;
  pdfUrl?: string | null;
};

export function fetchFarmReportsList(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined
): Promise<FarmReportListItemDto[]> {
  return apiGetJson<FarmReportListItemDto[]>(
    `/farms/${farmId}/reports`,
    accessToken,
    activeProfileId
  );
}

export function generateFarmReport(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  body: {
    periodType: FarmReportPeriodType;
    anchor: { year: number; month?: number; quarter?: number };
  }
): Promise<{
  id: string;
  reportId?: string;
  scoreGlobal: number;
  contentHash: string;
  downloadUrl?: string | null;
}> {
  return apiPostJson(
    `/farms/${farmId}/reports/generate`,
    body,
    accessToken,
    activeProfileId
  );
}

export type FarmReportDetailDto = {
  id: string;
  farmId: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  scoreBreakdown: unknown;
  dataSnapshot: unknown;
  contentHash: string | null;
};

export function fetchFarmReportById(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<FarmReportDetailDto> {
  return apiGetJson<FarmReportDetailDto>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}`,
    accessToken,
    activeProfileId
  );
}

export function farmReportPdfAbsoluteUrl(farmId: string, reportId: string): string {
  return `${apiBaseUrl()}/api/v1/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/pdf`;
}

export function fetchFarmReportDownloadUrl(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<{ downloadUrl: string }> {
  return apiGetJson<{ downloadUrl: string }>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/download`,
    accessToken,
    activeProfileId
  );
}

export type AIInsightDto = {
  type: string;
  priority: "critical" | "warning" | "info";
  title: string;
  message: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type AIRecommendationsResponseDto = {
  items: AIInsightDto[];
  generatedAt: string;
  insufficient?: boolean;
  unavailable?: boolean;
};

export function fetchAIRecommendations(
  accessToken: string,
  body: { farmId: string; module: string },
  activeProfileId?: string | null
): Promise<AIRecommendationsResponseDto> {
  return apiPostJson<AIRecommendationsResponseDto>(
    "/ai/recommendations",
    body,
    accessToken,
    activeProfileId
  );
}

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
    transferSowWithLitter?: boolean;
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

// ─── Profil acheteur (`/buyers/me`) ─────────────────────────────────────────

export type UpsertBuyerProfileBody = {
  buyerType?: string;
  businessName?: string;
  locationLabel?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  searchRadiusKm?: number;
  preferredCategories?: string[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  typicalVolume?: string;
  profilePhotoUrl?: string;
  onboardingComplete?: boolean;
};

export type BuyerDashboardDto = {
  profile: {
    buyerType: string;
    onboardingComplete: boolean;
    preferredCategories: string[];
    priceRangeMin: string | null;
    priceRangeMax: string | null;
  } | null;
  kpis: {
    pendingProposals: number;
    purchasesCount: number;
    favoritesCount: number;
    activeAlerts: number;
  };
};

export type BuyerProposalDto = {
  id: string;
  status: string;
  offeredPrice: string;
  proposedPricePerKg: string | null;
  quantity: number | null;
  message: string | null;
  counterPricePerKg: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    category: string;
    status: string;
    pricePerKg: string | null;
    farmName: string | null;
    sellerName: string | null;
  };
};

export type BuyerListingPreviewDto = {
  id: string;
  title: string;
  category: string;
  pricePerKg: string | null;
  totalPrice: string | null;
  weightKg: string | null;
  farmName: string | null;
  publishedAt: string | null;
  photoUrls: unknown;
};

export type BuyerFavoriteListingDto = BuyerListingPreviewDto & {
  favoriteId: string;
  favoritedAt: string;
};

export type BuyerPriceAlertDto = {
  id: string;
  animalCategory: string;
  maxPricePerKg: string;
  minWeightKg: string | null;
  radiusKm: number | null;
  notificationFrequency: string;
  isActive: boolean;
  createdAt: string;
  matchingListingsCount: number;
};

export type CreateBuyerPriceAlertBody = {
  animalCategory: string;
  maxPricePerKg: number;
  minWeightKg?: number;
  radiusKm?: number;
  notificationFrequency?: string;
  isActive?: boolean;
};

export type UpdateBuyerPriceAlertBody = Partial<CreateBuyerPriceAlertBody>;

/** PATCH /api/v1/buyers/me/profile */
export function upsertBuyerProfile(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: UpsertBuyerProfileBody
): Promise<unknown> {
  return apiPatchJson("/buyers/me/profile", body, accessToken, activeProfileId);
}

/** GET /api/v1/buyers/me/dashboard */
export function fetchBuyerDashboard(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerDashboardDto> {
  return apiGetJson<BuyerDashboardDto>(
    "/buyers/me/dashboard",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/personalized-listings */
export function fetchBuyerPersonalizedListings(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerListingPreviewDto[]> {
  return apiGetJson<BuyerListingPreviewDto[]>(
    "/buyers/me/personalized-listings",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/proposals */
export function fetchBuyerProposals(
  accessToken: string,
  activeProfileId?: string | null,
  status?: string
): Promise<BuyerProposalDto[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGetJson<BuyerProposalDto[]>(
    `/buyers/me/proposals${q}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/purchases */
export function fetchBuyerPurchases(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerProposalDto[]> {
  return apiGetJson<BuyerProposalDto[]>(
    "/buyers/me/purchases",
    accessToken,
    activeProfileId
  );
}

export type BuyerReviewDto = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  farmId: string;
  farmName: string;
};

/** GET /api/v1/buyers/me/reviews */
export function fetchBuyerReviews(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerReviewDto[]> {
  return apiGetJson<BuyerReviewDto[]>(
    "/buyers/me/reviews",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/price-alerts */
export function fetchBuyerPriceAlerts(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerPriceAlertDto[]> {
  return apiGetJson<BuyerPriceAlertDto[]>(
    "/buyers/me/price-alerts",
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/buyers/me/price-alerts */
export function createBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: CreateBuyerPriceAlertBody
): Promise<BuyerPriceAlertDto> {
  return apiPostJson<BuyerPriceAlertDto>(
    "/buyers/me/price-alerts",
    body,
    accessToken,
    activeProfileId
  );
}

/** PATCH /api/v1/buyers/me/price-alerts/:id */
export function updateBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  alertId: string,
  body: UpdateBuyerPriceAlertBody
): Promise<BuyerPriceAlertDto> {
  return apiPatchJson<BuyerPriceAlertDto>(
    `/buyers/me/price-alerts/${encodeURIComponent(alertId)}`,
    body,
    accessToken,
    activeProfileId
  );
}

/** DELETE /api/v1/buyers/me/price-alerts/:id */
export function deleteBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  alertId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/buyers/me/price-alerts/${encodeURIComponent(alertId)}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/favorites */
export function fetchBuyerFavorites(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerFavoriteListingDto[]> {
  return apiGetJson<BuyerFavoriteListingDto[]>(
    "/buyers/me/favorites",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/favorites/ids */
export function fetchBuyerFavoriteIds(
  accessToken: string,
  activeProfileId?: string | null
): Promise<string[]> {
  return apiGetJson<string[]>(
    "/buyers/me/favorites/ids",
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/buyers/me/favorites */
export function addBuyerFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  listingId: string
): Promise<{ ok: boolean; listingId: string; favoriteId: string }> {
  return apiPostJson(
    "/buyers/me/favorites",
    { listingId },
    accessToken,
    activeProfileId
  );
}

/** DELETE /api/v1/buyers/me/favorites/:listingId */
export function removeBuyerFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  listingId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/buyers/me/favorites/${encodeURIComponent(listingId)}`,
    accessToken,
    activeProfileId
  );
}

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

// ─── Finance + stock aliment ─────────────────────────────────────────────────

export type FinanceStockLineInput = {
  feedTypeId?: string;
  newFeedType?: { name: string; unit: "kg" | "sac" };
  quantityInput: number;
  quantityUnit: "kg" | "tonne" | "sac";
  unitPrice?: number;
  priceBasis?: "kg" | "sac";
  weightPerBagKg?: number;
  supplier?: string;
};

export type PostFinanceTransactionWithStockPayload = {
  amount: number;
  currency?: string;
  label: string;
  financeCategoryId?: string;
  occurredAt?: string;
  note?: string;
  attachmentUrl?: string;
  recordStock?: boolean;
  stockLines?: FinanceStockLineInput[];
};

/** POST /api/v1/farms/:farmId/finance/transactions/with-stock */
export function postFinanceTransactionWithStock(
  accessToken: string,
  farmId: string,
  payload: PostFinanceTransactionWithStockPayload,
  activeProfileId?: string | null
): Promise<FarmExpenseDto> {
  return apiPostJson<FarmExpenseDto>(
    `/farms/${farmId}/finance/transactions/with-stock`,
    payload,
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
