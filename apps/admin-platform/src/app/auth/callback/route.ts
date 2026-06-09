import { routing } from "@/i18n/routing";
import { ADMIN_OAUTH_NEXT_COOKIE } from "@/lib/admin-oauth";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function loginErrorRedirect(origin: string, locale: string, reason?: string) {
  const url = new URL(`/${locale}/login`, origin);
  url.searchParams.set("error", "oauth");
  if (reason) {
    url.searchParams.set("reason", reason.slice(0, 200));
  }
  return NextResponse.redirect(url);
}

function resolveLocale(next: string | null): string {
  const locales = routing.locales.join("|");
  const match = next?.match(new RegExp(`^/(${locales})/`));
  return match?.[1] ?? routing.defaultLocale;
}

function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return `/${routing.defaultLocale}/auth/complete`;
  }
  return next;
}

function readNextFromCookie(request: NextRequest): string | null {
  const raw = request.cookies.get(ADMIN_OAUTH_NEXT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextFromCookie = readNextFromCookie(request);
  const next = sanitizeNext(nextFromCookie ?? searchParams.get("next"));
  const locale = resolveLocale(next);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return loginErrorRedirect(origin, locale, "missing_env");
  }

  if (!code) {
    return loginErrorRedirect(origin, locale, "missing_code");
  }

  const redirectUrl = `${origin}${next}`;
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginErrorRedirect(origin, locale, error.message);
  }

  response.cookies.set(ADMIN_OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
