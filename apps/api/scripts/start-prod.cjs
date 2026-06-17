/**
 * Démarrage production : applique les migrations Prisma puis lance l'API NestJS.
 * Évite les 500 sur le marketplace (et autres modules) quand le schéma déployé
 * est en avance sur la base Railway / Supabase.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const apiRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(apiRoot, "..", "..");

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotenv(path.join(apiRoot, ".env"));
loadDotenv(path.join(monorepoRoot, ".env"));

// Railway / hébergeurs : NODE_ENV=production sans APP_ENV déclenchait le garde-fou
// mobile money (MOBILE_MONEY_PROVIDER=dev interdit). Tant que le gateway simulé
// est utilisé, forcer staging — aligné avec .env.example.
const mobileMoneyProvider = (process.env.MOBILE_MONEY_PROVIDER ?? "dev")
  .trim()
  .toLowerCase();
if (!process.env.APP_ENV?.trim() && mobileMoneyProvider === "dev") {
  process.env.APP_ENV = "staging";
  console.warn(
    "[start-prod] APP_ENV absent avec MOBILE_MONEY_PROVIDER=dev — APP_ENV=staging par défaut. " +
      "Définissez APP_ENV=production uniquement avec un provider mobile money réel."
  );
}

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

console.log("[start-prod] Démarrage de l'API…");
const main = spawnSync(process.execPath, [path.join(apiRoot, "dist", "main.js")], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit"
});

process.exit(main.status === null ? 1 : main.status);
