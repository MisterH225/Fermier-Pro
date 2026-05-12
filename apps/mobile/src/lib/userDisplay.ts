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
