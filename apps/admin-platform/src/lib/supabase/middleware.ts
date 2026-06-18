import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/** Routes admin exemptées de la vérification superadmin (login, auth). */
const ADMIN_EXEMPT_SEGMENTS = ["auth", "login"];

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && routing.locales.includes(first as (typeof routing.locales)[number])) {
    return `/${segments.slice(1).join("/")}` || "/";
  }
  return pathname;
}

function isExemptPath(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  if (path.startsWith("/_next") || path.startsWith("/api") || path.startsWith("/favicon")) {
    return true;
  }
  const segment = path.split("/").filter(Boolean)[0];
  return segment !== undefined && ADMIN_EXEMPT_SEGMENTS.includes(segment);
}

function localeFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && routing.locales.includes(first as (typeof routing.locales)[number])) {
    return first;
  }
  return routing.defaultLocale;
}

function isRefreshTokenError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "refresh_token_not_found" ||
    (error.message?.includes("Refresh Token Not Found") ?? false)
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isExemptPath(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const locale = localeFromPath(pathname);
  const loginUrl = new URL(`/${locale}/login`, request.url);

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    if (isRefreshTokenError(userError)) {
      await supabase.auth.signOut();
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.redirect(loginUrl);
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "";
  if (apiBase) {
    try {
      const check = await fetch(`${apiBase}/api/v1/admin/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });
      if (check.status === 401 || check.status === 403) {
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      // En cas d'API injoignable, laisser passer (la page gérera l'erreur)
    }
  }

  return response;
}
