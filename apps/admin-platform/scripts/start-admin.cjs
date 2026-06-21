/**
 * Démarrage Next.js admin — Railway injecte PORT ; Next doit écouter 0.0.0.0.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const adminRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(adminRoot, "..", "..");

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

function resolvePort() {
  const raw = (process.env.PORT ?? process.env.ADMIN_PORT ?? "3001").trim();
  const port = Number(raw);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error(
      `[start-admin] PORT invalide : "${raw}" (attendu 1–65535, ou ADMIN_PORT en local)`
    );
    process.exit(1);
  }
  return port;
}

loadDotenv(path.join(monorepoRoot, ".env"));
loadDotenv(path.join(adminRoot, ".env.local"));

const port = resolvePort();
const host = "0.0.0.0";

// Next lit aussi PORT ; évite un écart si la variable était vide ou mal formée.
process.env.PORT = String(port);
process.env.HOSTNAME = host;

const publicDomain = (process.env.RAILWAY_PUBLIC_DOMAIN ?? "").trim();

console.log(`[start-admin] Fermier Pro admin en écoute sur ${host}:${port}`);
if (publicDomain) {
  console.log(
    `[start-admin] Domaine Railway : ${publicDomain} — Networking → target port = ${port}`
  );
}

const nextBin = require.resolve("next/dist/bin/next", {
  paths: [adminRoot, monorepoRoot]
});
const main = spawnSync(
  process.execPath,
  [nextBin, "start", "-H", host, "-p", String(port)],
  {
    cwd: adminRoot,
    env: process.env,
    stdio: "inherit"
  }
);

process.exit(main.status === null ? 1 : main.status);
