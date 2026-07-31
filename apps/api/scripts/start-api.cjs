/**
 * Démarrage API sans migrations — pour Railway après preDeployCommand.
 * Répond vite au healthcheck liveness ; les migrations tournent en phase pre-deploy.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

const mainJs = path.join(apiRoot, "dist", "main.js");
if (!fs.existsSync(mainJs)) {
  console.error(
    `[start-api] Introuvable: ${mainJs}. Le build Nest (dist/) est absent — vérifiez la phase build Railway.`
  );
  process.exit(1);
}

const port = process.env.PORT || process.env.API_PORT || "3000";
console.log(
  `[start-api] Démarrage API (sans migrate) PORT=${port} NODE_ENV=${process.env.NODE_ENV || ""} APP_ENV=${process.env.APP_ENV || ""}`
);

const main = spawnSync(process.execPath, [mainJs], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit"
});

if (main.error) {
  console.error("[start-api] Échec spawn:", main.error);
  process.exit(1);
}

process.exit(main.status === null ? 1 : main.status);
