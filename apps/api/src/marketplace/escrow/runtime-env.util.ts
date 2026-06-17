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
