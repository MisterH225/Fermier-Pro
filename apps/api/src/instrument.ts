/**
 * Initialisation Sentry — doit être importée en premier dans main.ts.
 * Sans SENTRY_DSN : no-op (zéro impact local / CI).
 */
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import * as Sentry from "@sentry/nestjs";

// Env avant lecture de SENTRY_DSN (main.ts peut aussi recharger ensuite).
dotenvConfig({ path: join(process.cwd(), ".env"), override: true });
dotenvConfig({ path: join(process.cwd(), "../../.env"), override: true });

const PHONE_RE = /(\+?\d{1,3})[\d\s.-]{4,}/g;

function maskPhones(value: string): string {
  return value.replace(PHONE_RE, (match, country: string) => {
    const digits = match.replace(/\D/g, "");
    const countryDigits = String(country).replace(/\D/g, "");
    if (countryDigits.length >= 1 && digits.startsWith(countryDigits)) {
      const prefix = match.trim().startsWith("+")
        ? `+${countryDigits}`
        : countryDigits;
      return `${prefix}****`;
    }
    return "****";
  });
}

function scrubValue(value: unknown, keyHint = ""): unknown {
  const key = keyHint.toLowerCase();
  if (
    key === "authorization" ||
    key === "cookie" ||
    key.includes("webhook") ||
    key === "body" ||
    key === "rawbody" ||
    key === "payload" ||
    key === "data"
  ) {
    return "[Filtered]";
  }
  if (typeof value === "string") {
    return maskPhones(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => scrubValue(item, String(i)));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, k);
    }
    return out;
  }
  return value;
}

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  // Profiling optionnel : no-op si le binaire natif échoue (CI / Windows).
  let profilingIntegration: ReturnType<
    typeof import("@sentry/profiling-node").nodeProfilingIntegration
  > | null = null;
  try {
    // Import dynamique : évite de faire planter le boot si le profiler natif manque.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const profiling = require("@sentry/profiling-node") as typeof import("@sentry/profiling-node");
    profilingIntegration = profiling.nodeProfilingIntegration();
  } catch {
    profilingIntegration = null;
  }

  Sentry.init({
    dsn,
    environment: process.env.APP_ENV?.trim() || "development",
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: 0.1,
    profilesSampleRate: profilingIntegration ? 0.1 : 0,
    ...(profilingIntegration
      ? { integrations: [profilingIntegration] }
      : {}),
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = { ...event.request.headers };
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === "authorization") {
            headers[key] = "[Filtered]";
          }
        }
        event.request.headers = headers;
      }
      // Ne jamais envoyer les corps de requêtes (webhooks inclus).
      if (event.request?.data !== undefined) {
        event.request.data = "[Filtered]";
      }
      if (event.request?.query_string) {
        event.request.query_string = scrubValue(
          event.request.query_string,
          "query"
        ) as string;
      }
      if (event.extra) {
        event.extra = scrubValue(event.extra) as Record<string, unknown>;
      }
      if (event.contexts) {
        event.contexts = scrubValue(event.contexts) as typeof event.contexts;
      }
      if (event.message) {
        event.message = maskPhones(event.message);
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) {
            ex.value = maskPhones(ex.value);
          }
        }
      }
      return event;
    }
  });
}
