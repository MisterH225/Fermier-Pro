/** Cookie court terme pour la destination post-OAuth (évite ?next= dans redirect_to). */
export const ADMIN_OAUTH_NEXT_COOKIE = "admin-oauth-next";

/**
 * URL de retour OAuth — sans query string.
 * Doit correspondre exactement à une Redirect URL Supabase (ex. http://localhost:3001/auth/callback).
 * Si redirect_to contient ?next=, Supabase peut rejeter l’URL et retomber sur Site URL (exp://) → page blanche Google.
 */
export function getAdminOAuthRedirectTo(): string {
  const base =
    (typeof window !== "undefined" ? window.location.origin : null) ??
    process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") ??
    "http://localhost:3001";

  return `${base}/auth/callback`;
}

export function getAdminOAuthNextPath(locale: string): string {
  return `/${locale}/auth/complete`;
}

export function getAdminRecoveryNextPath(locale: string): string {
  return `/${locale}/reset-password`;
}

/** redirectTo Supabase pour resetPasswordForEmail (next en query : le lien email survit sans cookie). */
export function getAdminPasswordRecoveryRedirectTo(locale: string): string {
  const base = getAdminOAuthRedirectTo();
  const next = encodeURIComponent(getAdminRecoveryNextPath(locale));
  return `${base}?next=${next}`;
}

/** URL à copier dans Supabase (sans query). */
export function getAdminOAuthRedirectAllowListEntry(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  const base = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
  return `${base}/auth/callback`;
}

/** Wildcard recommandé en dev (optionnel). */
export function getAdminOAuthRedirectWildcardEntry(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/**`;
  }
  const base = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
  return `${base}/**`;
}

export function setAdminOAuthNextCookie(locale: string): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(getAdminOAuthNextPath(locale));
  document.cookie = `${ADMIN_OAUTH_NEXT_COOKIE}=${value};path=/;max-age=600;SameSite=Lax`;
}
