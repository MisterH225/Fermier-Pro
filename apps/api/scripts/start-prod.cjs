/**
 * Démarrage production : applique les migrations Prisma puis lance l'API NestJS.
 * Évite les 500 sur le marketplace (et autres modules) quand le schéma déployé
 * est en avance sur la base Railway / Supabase.
 *
 * Sur Railway, les migrations passent en preDeployCommand ; utiliser start-api.cjs.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

const skipMigrate =
  process.env.SKIP_PRISMA_MIGRATE === "1" ||
  process.env.SKIP_PRISMA_MIGRATE === "true";

if (!skipMigrate) {
  const prismaRun = path.join(__dirname, "prisma-run.cjs");
  console.log("[start-prod] Application des migrations Prisma…");
  const migrate = spawnSync(process.execPath, [prismaRun, "migrate", "deploy"], {
    cwd: apiRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (migrate.status !== 0) {
    console.error("[start-prod] Échec de prisma migrate deploy — arrêt.");
    process.exit(migrate.status === null ? 1 : migrate.status);
  }
} else {
  console.log("[start-prod] SKIP_PRISMA_MIGRATE — migrations ignorées.");
}

console.log("[start-prod] Démarrage de l'API…");
const main = spawnSync(process.execPath, [path.join(apiRoot, "dist", "main.js")], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit"
});

process.exit(main.status === null ? 1 : main.status);
