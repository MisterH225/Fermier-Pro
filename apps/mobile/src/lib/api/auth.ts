/**
 * Auth, profils et CGU — extrait de `api.ts` (découpage P3).
 */
import {
  apiDeleteJson,
  apiGetJson,
  apiPatchJson,
  apiPostJson
} from "./http";

export type AuthMePrimaryFarm = {
  id: string;
  name: string;
};

export type FarmStatus = "active" | "archived";

export type CguStatusDto = {
  currentVersion: string;
  acceptedAt: string | null;
  versionAccepted: string | null;
  needsAcceptance: boolean;
  isUpdate: boolean;
};

export type CguCurrentDto = {
  version: string;
  content: string;
  contentUrl: string | null;
  updatedAt: string;
  privacyPolicyContent: string;
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
  accountStatus?: "active" | "suspended" | "banned";
  suspendedReason?: string | null;
  suspendedUntil?: string | null;
  bannedReason?: string | null;
  notificationsEnabled: boolean;
  pushNotificationsRegistered: boolean;
  isOnboarded: boolean;
  onboardingSkipped: boolean;
  cguAcceptedAt: string | null;
  cguVersionAccepted: string | null;
};

export type VetVerificationStatus = "pending" | "verified" | "rejected";

export type VetProfessionalMeDto = {
  profileId: string | null;
  verificationStatus: VetVerificationStatus | null;
  rejectionReason: string | null;
  onboardingComplete: boolean;
};

export type AuthMeResponse = {
  cgu?: CguStatusDto;
  user: AuthMeUser;
  /** Première ferme propriétaire (ordre de création), pour libellé accueil producteur. @deprecated Use activeFarm instead. */
  primaryFarm: AuthMePrimaryFarm | null;
  /** Projet actif sélectionné par l'utilisateur. */
  activeFarm: AuthMePrimaryFarm | null;
  profiles: Array<{
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
    avatarUrl: string | null;
    profileStatus?: "active" | "suspended" | "banned";
    profileSuspendedReason?: string | null;
  }>;
  activeProfile: {
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
    avatarUrl: string | null;
    profileStatus?: "active" | "suspended" | "banned";
    profileSuspendedReason?: string | null;
  } | null;
  technicianProfile?: {
    profileId: string;
    onboardingComplete: boolean;
    experienceYears: string | null;
  } | null;
  buyerProfile?: {
    profileId: string;
    onboardingComplete: boolean;
    buyerType: string;
    preferredCategories: string[];
  } | null;
  vetProfessional?: VetProfessionalMeDto;
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
export function fetchCguCurrent(accessToken: string): Promise<CguCurrentDto> {
  return apiGetJson<CguCurrentDto>("/cgu/current", accessToken, null);
}

export function acceptCgu(
  accessToken: string,
  version: string
): Promise<AuthMeResponse> {
  return apiPostJson<AuthMeResponse>(
    "/auth/me/accept-cgu",
    { version },
    accessToken,
    null
  );
}

export function fetchAuthMe(
  accessToken: string,
  activeProfileId?: string
): Promise<AuthMeResponse> {
  return apiGetJson<AuthMeResponse>(
    "/auth/me",
    accessToken,
    activeProfileId ?? null
  );
}

/** DELETE /api/v1/auth/me/account — suppression définitive du compte et des données. */
export function deleteMyAccount(
  accessToken: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>("/auth/me/account", accessToken);
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

/** Type d'un message admin (modération, info, avertissement). */
export type AdminMessageTypeDto = "notification" | "warning" | "info";

export type AdminMessageDto = {
  id: string;
  subject: string;
  message: string;
  type: AdminMessageTypeDto;
  isRead: boolean;
  sentAt: string;
  readAt: string | null;
  admin: { id: string; fullName: string | null; email: string | null };
};

export type AdminMessagesListDto = {
  total: number;
  items: AdminMessageDto[];
};

/** GET /api/v1/auth/me/admin-messages — historique messages admin → utilisateur. */
export function fetchMyAdminMessages(
  accessToken: string
): Promise<AdminMessagesListDto> {
  return apiGetJson<AdminMessagesListDto>("/auth/me/admin-messages", accessToken);
}

/** GET /api/v1/auth/me/admin-messages/unread-count — badge cloche. */
export function fetchMyAdminMessagesUnreadCount(
  accessToken: string
): Promise<{ count: number }> {
  return apiGetJson<{ count: number }>(
    "/auth/me/admin-messages/unread-count",
    accessToken
  );
}

/** PATCH /api/v1/auth/me/admin-messages/:id/read — marque le message comme lu. */
export function markMyAdminMessageRead(
  accessToken: string,
  messageId: string
): Promise<{ ok: boolean }> {
  return apiPatchJson<{ ok: boolean }>(
    `/auth/me/admin-messages/${messageId}/read`,
    {},
    accessToken
  );
}

/** DELETE /api/v1/auth/me/admin-messages/:id — supprime un message admin reçu. */
export function deleteMyAdminMessage(
  accessToken: string,
  messageId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/auth/me/admin-messages/${messageId}`,
    accessToken
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

