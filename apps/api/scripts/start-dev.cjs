/**
 * Lance `nest start --watch` avec heap étendu, en résolvant @nestjs/cli
 * depuis le workspace (hoist racine ou node_modules local).
 *
 * Charge le .env racine du monorepo en premier pour que DATABASE_URL et
 * SUPABASE_JWT_SECRET soient disponibles dans process.env avant que Prisma
 * valide le datasource au démarrage.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const apiRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(apiRoot, "..", "..");

// Charge le .env racine si présent (dotenv-light sans dépendance externe).
function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Retire les guillemets enveloppants si présents.
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Ne pas écraser les variables déjà définies dans le shell parent.
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotenv(path.join(monorepoRoot, ".env"));
loadDotenv(path.join(apiRoot, ".env")); // surcharge locale éventuelle

// Libère le port si un précédent processus l'occupe encore.
const port = process.env.API_PORT || "3000";
try {
  const { execSync } = require("node:child_process");
  const out = execSync(
    `netstat -ano | findstr :${port}`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
  );
  const pids = [...new Set(
    out.trim().split(/\r?\n/)
      .map(l => l.trim().split(/\s+/).pop())
      .filter(p => p && /^\d+$/.test(p) && p !== "0")
  )];
  for (const pid of pids) {
    try { execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" }); }
    catch { /* déjà terminé */ }
  }
  if (pids.length) console.log(`[start-dev] Port ${port} libéré (PID ${pids.join(", ")})`);
} catch { /* findstr retourne exit 1 si aucun résultat — port déjà libre */ }

const nestEntry = require.resolve("@nestjs/cli/bin/nest.js", {
  paths: [apiRoot]
});

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=8192", nestEntry, "start", "--watch"],
  { stdio: "inherit", cwd: apiRoot, env: process.env }
);

process.exit(result.status === null ? 1 : result.status);
