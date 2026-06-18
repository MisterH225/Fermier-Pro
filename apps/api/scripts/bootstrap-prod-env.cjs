/**
 * Charge les .env et applique les garde-fous production (APP_ENV / mobile money).
 * Partagé par start-prod.cjs (migrate + API) et start-api.cjs (API seule, Railway).
 */
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

function bootstrapProdEnv() {
  loadDotenv(path.join(apiRoot, ".env"));
  loadDotenv(path.join(monorepoRoot, ".env"));

  const mobileMoneyProvider = (process.env.MOBILE_MONEY_PROVIDER ?? "dev")
    .trim()
    .toLowerCase();
  if (!process.env.APP_ENV?.trim() && mobileMoneyProvider === "dev") {
    process.env.APP_ENV = "staging";
    console.warn(
      "[bootstrap-prod-env] APP_ENV absent avec MOBILE_MONEY_PROVIDER=dev — APP_ENV=staging par défaut. " +
        "Définissez APP_ENV=production uniquement avec un provider mobile money réel."
    );
  }
}

module.exports = { apiRoot, bootstrapProdEnv };
