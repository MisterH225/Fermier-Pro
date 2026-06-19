import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@fermier_pro/pending_invite_token";

/** Extrait le jeton d'invitation depuis une URL deep link ou universal link. */
export function parseInviteTokenFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const invitePath = trimmed.match(/\/invite\/([^/?#]+)/i);
    if (invitePath?.[1]) {
      const token = decodeURIComponent(invitePath[1]).trim();
      return token.length >= 16 ? token : null;
    }

    if (/^fermier-pro:\/\//i.test(trimmed)) {
      const withoutScheme = trimmed.replace(/^fermier-pro:\/\//i, "");
      const [head, ...rest] = withoutScheme.split("/").filter(Boolean);
      if (head === "invite" && rest[0]) {
        const token = decodeURIComponent(rest[0]).trim();
        return token.length >= 16 ? token : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function savePendingInviteToken(token: string): Promise<void> {
  const cleaned = token.trim();
  if (cleaned.length < 16) {
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, cleaned);
}

export async function getPendingInviteToken(): Promise<string | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) {
    return null;
  }
  const cleaned = value.trim();
  return cleaned.length >= 16 ? cleaned : null;
}

export async function clearPendingInviteToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
