import { apiGetJson, apiPostJson } from "./http";

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
