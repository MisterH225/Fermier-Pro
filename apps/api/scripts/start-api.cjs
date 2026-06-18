/**
 * Démarrage API sans migrations — pour Railway après preDeployCommand.
 * Répond vite au healthcheck ; les migrations tournent en phase pre-deploy.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

console.log("[start-api] Démarrage de l'API (sans migrate)…");
const main = spawnSync(process.execPath, [path.join(apiRoot, "dist", "main.js")], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit"
});

process.exit(main.status === null ? 1 : main.status);
