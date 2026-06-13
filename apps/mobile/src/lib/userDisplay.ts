import type { AuthMeUser } from "./api";

export function welcomeFirstName(user: AuthMeUser | null | undefined): string {
  if (!user) {
    return "toi";
  }
  const f = user.firstName?.trim();
  if (f) {
    return f;
  }
  const full = user.fullName?.trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) {
      return first;
    }
  }
  return "toi";
}

/** Prénom + initiale du nom (ex. Harold B.) — jamais l’email. */
export function formatPrivacyDisplayName(
  fullName: string | null | undefined
): string {
  const raw = fullName?.trim();
  if (!raw) {
    return "—";
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "—";
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase() ?? "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}
