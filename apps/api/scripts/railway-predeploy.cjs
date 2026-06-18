/**
 * Pre-deploy Railway : migrations Prisma avec récupération P3009 (wallet / orchestrateur).
 * Le schéma peut déjà exister sur Supabase alors que _prisma_migrations marque failed.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { apiRoot, bootstrapProdEnv } = require("./bootstrap-prod-env.cjs");

bootstrapProdEnv();

const prismaRun = path.join(__dirname, "prisma-run.cjs");

/** Migrations souvent en conflit après application SQL Supabase + rename wallet. */
const RECOVERABLE_MIGRATIONS = [
  "20260624120000_universal_user_wallet",
  "20260625120000_payment_orchestrator"
];

function runPrisma(args) {
  return spawnSync(process.execPath, [prismaRun, ...args], {
    cwd: apiRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"]
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function tryRecoverFailedMigrations(output) {
  const needsRecovery =
    output.includes("P3009") ||
    output.toLowerCase().includes("failed migrations");
  if (!needsRecovery) {
    return false;
  }

  console.warn(
    "[railway-predeploy] Migration(s) en échec détectée(s) — resolve --applied sur wallet/orchestrateur…"
  );

  for (const name of RECOVERABLE_MIGRATIONS) {
    const resolved = runPrisma(["migrate", "resolve", "--applied", name]);
    if (resolved.status === 0) {
      console.log(`[railway-predeploy] Marquée appliquée : ${name}`);
    }
  }
  return true;
}

console.log("[railway-predeploy] prisma migrate deploy…");
let deploy = runPrisma(["migrate", "deploy"]);

if (deploy.status !== 0) {
  const output = combinedOutput(deploy);
  process.stderr.write(output);
  if (tryRecoverFailedMigrations(output)) {
    console.log("[railway-predeploy] Nouvelle tentative migrate deploy…");
    deploy = runPrisma(["migrate", "deploy"]);
  }
}

if (deploy.stdout) {
  process.stdout.write(deploy.stdout);
}
if (deploy.stderr) {
  process.stderr.write(deploy.stderr);
}

if (deploy.status !== 0) {
  console.error("[railway-predeploy] Échec définitif de migrate deploy.");
}

process.exit(deploy.status === null ? 1 : deploy.status);
