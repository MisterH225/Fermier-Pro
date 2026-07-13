import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

function resolveEnvironment(): string {
  return (
    process.env.EXPO_PUBLIC_APP_ENV?.trim() ||
    process.env.APP_ENV?.trim() ||
    "development"
  );
}

function resolveRelease(): string | undefined {
  const version = Constants.expoConfig?.version?.trim();
  const iosBuild = Constants.expoConfig?.ios?.buildNumber?.trim();
  const androidCode = Constants.expoConfig?.android?.versionCode;
  const build =
    iosBuild || (androidCode != null ? String(androidCode) : undefined);
  if (!version) {
    return undefined;
  }
  return build ? `fermier-mobile@${version}+${build}` : `fermier-mobile@${version}`;
}

/**
 * Init Sentry mobile — no-op si EXPO_PUBLIC_SENTRY_DSN absent.
 */
export function initSentry(): void {
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    release: resolveRelease(),
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    // Pas de PII : pas de breadcrumbs request body, pas de user email par défaut.
    sendDefaultPii: false
  });
}

export { Sentry };
