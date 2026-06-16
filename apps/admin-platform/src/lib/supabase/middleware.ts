import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes admin exemptées de la vérification superadmin (login, auth). */
const ADMIN_EXEMPT_PATHS = ["/auth", "/login", "/_next", "/api", "/favicon"];

function isExemptPath(pathname: string): boolean {
  return ADMIN_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
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

  const { data: { session } } = await supabase.auth.getSession();

  // Bloquer les routes dashboard si pas de session ou pas superadmin
  const { pathname } = request.nextUrl;
  if (!isExemptPath(pathname)) {
    if (!session?.access_token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Vérification superadmin côté serveur via l'API NestJS
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "";
    if (apiBase) {
      try {
        const check = await fetch(`${apiBase}/api/v1/admin/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store"
        });
        if (check.status === 401 || check.status === 403) {
          return NextResponse.redirect(new URL("/login", request.url));
        }
      } catch {
        // En cas d'API injoignable, laisser passer (la page gérera l'erreur)
      }
    }
  }

  return response;
}
