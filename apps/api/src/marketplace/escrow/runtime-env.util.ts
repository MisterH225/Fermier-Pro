const NON_PRODUCTION_APP_ENVS = new Set([
  "development",
  "dev",
  "test",
  "staging",
  "preview"
]);

/**
 * Environnement de déploiement « production » (paiements réels, webhooks stricts).
 *
 * APP_ENV=production|prod prend la priorité.
 * APP_ENV=staging|preview|development désactive les garde-fous « prod » même si NODE_ENV=production.
 * Si APP_ENV est absent, NODE_ENV=production est traité comme production
 * pour éviter qu'un déploiement mal configuré échappe aux garde-fous financiers.
 */
export function isDeploymentProduction(): boolean {
  const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
  if (appEnv === "production" || appEnv === "prod") return true;
  if (NON_PRODUCTION_APP_ENVS.has(appEnv)) return false;
  // Fallback : si APP_ENV absent, se baser sur NODE_ENV
  return (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

/** True si le process tourne sur Railway (variables injectées par la plateforme). */
export function isRunningOnRailway(): boolean {
  return Boolean(
    (process.env.RAILWAY_ENVIRONMENT ?? "").trim() ||
      (process.env.RAILWAY_PROJECT_ID ?? "").trim()
  );
}

/**
 * Sur Railway, APP_ENV doit être défini explicitement (staging|production|…).
 * Empêche un déploiement où les garde-fous liés à APP_ENV (JWT ES256, mobile money…)
 * retombent silencieusement sur des fallbacks locaux.
 * Hors Railway (dev local) : no-op si APP_ENV est absent.
 */
export function assertAppEnvConfiguredOnRailway(): void {
  if (!isRunningOnRailway()) return;
  const appEnv = (process.env.APP_ENV ?? "").trim();
  if (appEnv) return;
  throw new Error(
    "APP_ENV est obligatoire sur Railway (RAILWAY_ENVIRONMENT ou RAILWAY_PROJECT_ID détecté). " +
      "Définissez APP_ENV=staging ou APP_ENV=production avant le démarrage."
  );
}
