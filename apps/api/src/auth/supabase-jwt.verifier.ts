import { UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import * as jwt from "jsonwebtoken";
import type { SupabaseJwtPayload } from "./types/supabase-jwt.payload";

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedIssuer: string | null = null;

function peekJwtAlgorithm(token: string): string | null {
  const part = token.split(".")[0];
  if (!part) {
    return null;
  }
  try {
    const header = JSON.parse(
      Buffer.from(part, "base64url").toString("utf8")
    ) as { alg?: string };
    return header.alg ?? null;
  } catch {
    return null;
  }
}

function jwksForSupabaseUrl(supabaseUrl: string): {
  jwks: ReturnType<typeof createRemoteJWKSet>;
  issuer: string;
} {
  const base = supabaseUrl.replace(/\/$/, "");
  const issuer = `${base}/auth/v1`;
  if (!cachedJwks || cachedIssuer !== issuer) {
    cachedIssuer = issuer;
    cachedJwks = createRemoteJWKSet(
      new URL(`${issuer}/.well-known/jwks.json`)
    );
  }
  return { jwks: cachedJwks, issuer };
}

async function verifyEs256WithJwks(
  token: string,
  supabaseUrl: string
): Promise<SupabaseJwtPayload> {
  const { jwks, issuer } = jwksForSupabaseUrl(supabaseUrl);
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    if (!payload.sub) {
      throw new UnauthorizedException("Jeton invalide");
    }
    return payload as SupabaseJwtPayload;
  } catch (e) {
    if (e instanceof UnauthorizedException) {
      throw e;
    }
    throw new UnauthorizedException("Jeton invalide ou expire");
  }
}

function verifyHs256WithSecret(
  token: string,
  secret: string
): SupabaseJwtPayload {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    }) as SupabaseJwtPayload;
    if (!decoded?.sub) {
      throw new UnauthorizedException("Jeton invalide");
    }
    return decoded;
  } catch {
    throw new UnauthorizedException("Jeton invalide ou expire");
  }
}

/**
 * Vérifie un access_token Supabase.
 * - Jetons réels (Google, SMS, etc.) : **ES256** via JWKS (`SUPABASE_URL`).
 * - Tests e2e / legacy : **HS256** via `SUPABASE_JWT_SECRET`.
 */
export async function verifySupabaseAccessToken(
  token: string,
  options: {
    supabaseUrl?: string;
    hs256Secret?: string;
  }
): Promise<SupabaseJwtPayload> {
  const alg = peekJwtAlgorithm(token);
  const appEnv = (process.env.APP_ENV ?? "").toLowerCase();
  const isDeployed = appEnv === "production" || appEnv === "staging";

  if (isDeployed && alg !== "ES256" && alg !== "RS256") {
    throw new UnauthorizedException("Algorithme JWT non supporté en production");
  }

  if (alg === "ES256" || alg === "RS256") {
    const url = options.supabaseUrl?.trim();
    if (!url) {
      throw new UnauthorizedException(
        "SUPABASE_URL manquant (requis pour vérifier les jetons Supabase ES256)"
      );
    }
    return verifyEs256WithJwks(token, url);
  }

  const secret = options.hs256Secret?.trim();
  if (!secret) {
    throw new UnauthorizedException("SUPABASE_JWT_SECRET manquant");
  }
  return verifyHs256WithSecret(token, secret);
}
