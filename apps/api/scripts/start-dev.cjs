/**
 * Lance `nest start --watch` avec heap étendu, en résolvant @nestjs/cli
 * depuis le workspace (hoist racine ou node_modules local).
 *
 * Charge les .env avant de spawner Nest pour que DATABASE_URL,
 * SUPABASE_JWT_SECRET, etc. soient dans process.env dès le démarrage Prisma.
 * Priorité : apps/api/.env (local) > .env racine (défauts monorepo).
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const apiRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(apiRoot, "..", "..");

// Parseur dotenv minimal sans dépendance externe.
// N'écrase PAS les clés déjà présentes dans process.env (le fichier chargé
// en premier a donc la priorité la plus haute).
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

// Local en premier (priorité haute) ; la racine ne remplit que les clés absentes.
loadDotenv(path.join(apiRoot, ".env"));
loadDotenv(path.join(monorepoRoot, ".env"));

// Libère le port si un précédent processus l'occupe encore.
const port = process.env.API_PORT || "3000";
try {
  const { execSync } = require("node:child_process");
  // On obtient toute la sortie netstat et on filtre en JS sur la colonne
  // adresse locale uniquement, évitant les faux positifs de findstr qui
  // ferait une correspondance sous-chaîne (":3000" matcherait ":30001", etc.).
  const out = execSync("netstat -ano", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"]
  });
  const pids = [
    ...new Set(
      out
        .trim()
        .split(/\r?\n/)
        .filter((line) => {
          const parts = line.trim().split(/\s+/);
          // parts[1] = adresse locale (ex. "0.0.0.0:3000" ou ":::3000")
          return parts[1] && parts[1].endsWith(`:${port}`);
        })
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((p) => p && /^\d+$/.test(p) && p !== "0")
    )
  ];
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } catch {
      /* déjà terminé */
    }
  }
  if (pids.length)
    console.log(`[start-dev] Port ${port} libéré (PID ${pids.join(", ")})`);
} catch {
  /* netstat indisponible ou autre erreur système — on continue */
}

const nestEntry = require.resolve("@nestjs/cli/bin/nest.js", {
  paths: [apiRoot]
});

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=8192", nestEntry, "start", "--watch"],
  { stdio: "inherit", cwd: apiRoot, env: process.env }
);

process.exit(result.status === null ? 1 : result.status);
