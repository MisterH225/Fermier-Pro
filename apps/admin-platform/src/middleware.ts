import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|auth|api|favicon.ico|.*\\..*).*)"]
};
