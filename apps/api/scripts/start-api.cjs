/**
 * Démarrage API sans migrations — pour Railway après preDeployCommand.
 * Répond vite au healthcheck ; les migrations tournent en phase pre-deploy.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

const publicDomain = (process.env.RAILWAY_PUBLIC_DOMAIN ?? "").toLowerCase();
const serviceName = (process.env.RAILWAY_SERVICE_NAME ?? "").toLowerCase();
const onAdminHost =
  publicDomain.includes("admin-platform") || serviceName.includes("admin");
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();

if (onAdminHost) {
  console.error(
    `[start-api] Mauvais service Railway : l'API NestJS ne doit pas tourner sur la console admin.
Domaine public : ${publicDomain || "(inconnu)"}
Service       : ${serviceName || "(inconnu)"}

→ Service admin → Settings → Config file path = railway.admin.json
→ Start Command = node apps/admin-platform/scripts/start-admin.cjs
→ Réutilisez les variables Supabase du service API (pas DATABASE_URL) :
   NEXT_PUBLIC_SUPABASE_URL=\${{<service-api>.SUPABASE_URL}}
   NEXT_PUBLIC_API_URL=https://<service-api>.up.railway.app

Voir docs/RAILWAY.md`
  );
  process.exit(1);
}

if (!databaseUrl) {
  console.error(
    `[start-api] DATABASE_URL manquant sur le service API.
Copiez la valeur depuis Supabase (pooler 6543) ou référencez le service Postgres :
  DATABASE_URL=\${{<service-postgres>.DATABASE_URL}}
Voir docs/RAILWAY.md`
  );
  process.exit(1);
}

console.log("[start-api] Démarrage de l'API (sans migrate)…");
const main = spawnSync(process.execPath, [path.join(apiRoot, "dist", "main.js")], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit"
});

process.exit(main.status === null ? 1 : main.status);
