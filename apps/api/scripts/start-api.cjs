/**
 * Démarrage API sans migrations — pour Railway après preDeployCommand.
 * Répond vite au healthcheck liveness ; les migrations tournent en phase pre-deploy.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

/** Nest émet normalement dist/main.js ; dist/src/main.js = rootDir cassé (import hors src). */
function resolveMainJs() {
  const candidates = [
    path.join(apiRoot, "dist", "main.js"),
    path.join(apiRoot, "dist", "src", "main.js")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const mainJs = resolveMainJs();
if (!mainJs) {
  console.error(
    "[start-api] Introuvable: dist/main.js (ni dist/src/main.js). Vérifiez nest build / tsconfig.build.json."
  );
  process.exit(1);
}

if (mainJs.endsWith(`${path.sep}src${path.sep}main.js`)) {
  console.warn(
    "[start-api] ATTENTION: main.js sous dist/src/ — rootDir TypeScript incorrect (import hors src/?). Preferer tsconfig.build.json excluant les *.spec.ts."
  );
}

const port = process.env.PORT || process.env.API_PORT || "3000";
console.log(
  `[start-api] Démarrage ${mainJs} PORT=${port} NODE_ENV=${process.env.NODE_ENV || ""} APP_ENV=${process.env.APP_ENV || ""}`
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
