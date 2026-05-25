import type { AuthMeResponse } from "./api";

/** Photo du profil actif (ou d’un profil donné), avec repli sur l’avatar legacy User. */
export function resolveActiveProfileAvatarUrl(
  authMe: AuthMeResponse | null | undefined,
  profileId?: string | null
): string | null {
  if (!authMe) {
    return null;
  }
  const pid = profileId ?? authMe.activeProfile?.id;
  const profile = pid
    ? authMe.profiles.find((p) => p.id === pid)
    : authMe.activeProfile;
  return profile?.avatarUrl ?? authMe.user.avatarUrl ?? null;
}
