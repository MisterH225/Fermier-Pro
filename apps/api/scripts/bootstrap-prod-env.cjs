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

  // Gateway simulé : l'API doit démarrer en staging même si Railway a APP_ENV=production
  // ou NODE_ENV=production sans APP_ENV (sinon MobileMoneyGatewayGuard crash au boot).
  if (mobileMoneyProvider === "dev") {
    const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
    const isExplicitProduction = appEnv === "production" || appEnv === "prod";
    const isImplicitProduction =
      !appEnv && (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";

    if (!appEnv || isExplicitProduction || isImplicitProduction) {
      if (isExplicitProduction) {
        console.warn(
          "[bootstrap-prod-env] APP_ENV=production incompatible avec MOBILE_MONEY_PROVIDER=dev — forcé à staging. " +
            "Branchez un provider réel avant APP_ENV=production."
        );
      } else {
        console.warn(
          "[bootstrap-prod-env] APP_ENV absent avec MOBILE_MONEY_PROVIDER=dev — APP_ENV=staging par défaut. " +
            "Définissez APP_ENV=production uniquement avec un provider mobile money réel."
        );
      }
      process.env.APP_ENV = "staging";
    }
  }
}

module.exports = { apiRoot, bootstrapProdEnv };
