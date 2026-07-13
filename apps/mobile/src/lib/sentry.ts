import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/**
 * Init Sentry mobile — no-op si EXPO_PUBLIC_SENTRY_DSN absent.
 */
export function initSentry(): void {
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV?.trim() || "development",
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    // Pas de PII : pas de breadcrumbs request body, pas de user email par défaut.
    sendDefaultPii: false
  });
}

export { Sentry };
