/**
 * Environnement de déploiement « production » (paiements réels, webhooks stricts).
 *
 * NODE_ENV=production seul (Railway, builds optimisés) ne suffit pas : seul
 * APP_ENV=production|prod déclenche les garde-fous stricts.
 */
export function isDeploymentProduction(): boolean {
  const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
  return appEnv === "production" || appEnv === "prod";
}
