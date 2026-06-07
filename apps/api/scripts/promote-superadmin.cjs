/**
 * Promouvoir un utilisateur existant en SuperAdmin (console web).
 *
 * Usage :
 *   node scripts/promote-superadmin.cjs --email user@example.com
 *   node scripts/promote-superadmin.cjs --user-id clxxxxxxxx
 *   node scripts/promote-superadmin.cjs --email user@example.com --list
 */
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const apiRoot = path.join(__dirname, "..");
const repoRoot = path.join(__dirname, "..", "..", "..");

const rootEnv = path.join(repoRoot, ".env");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: false });
}
const apiEnv = path.join(apiRoot, ".env");
if (fs.existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv, override: false });
}

const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
  const out = { email: null, userId: null, list: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      out.list = true;
    } else if (arg === "--email" && argv[i + 1]) {
      out.email = argv[++i];
    } else if (arg === "--user-id" && argv[i + 1]) {
      out.userId = argv[++i];
    } else if (arg === "-h" || arg === "--help") {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Promouvoir un utilisateur en SuperAdmin

Options :
  --email <adresse>     Email de la table User
  --user-id <cuid>      Id Prisma User (pas supabaseUserId)
  --list                Afficher les SuperAdmin existants
  -h, --help            Cette aide

Exemple :
  npm run promote:superadmin -- --email admin@fermier.local
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL manquant (.env racine ou apps/api/.env).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (args.list) {
      const rows = await prisma.superAdmin.findMany({
        include: {
          user: { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: "asc" }
      });
      if (rows.length === 0) {
        console.log("Aucun SuperAdmin enregistré.");
        return;
      }
      console.log("SuperAdmins :");
      for (const row of rows) {
        console.log(
          `  - ${row.user.email ?? row.user.id} (${row.user.fullName ?? "—"}) [userId=${row.userId}]`
        );
      }
      return;
    }

    if (!args.email && !args.userId) {
      printHelp();
      process.exit(1);
    }

    const user = args.userId
      ? await prisma.user.findUnique({ where: { id: args.userId } })
      : await prisma.user.findFirst({ where: { email: args.email } });

    if (!user) {
      console.error("Utilisateur introuvable.");
      process.exit(1);
    }

    const row = await prisma.superAdmin.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {}
    });

    console.log("SuperAdmin OK");
    console.log(`  userId:      ${user.id}`);
    console.log(`  email:       ${user.email ?? "—"}`);
    console.log(`  superAdminId: ${row.id}`);
    console.log("\nConnexion : http://localhost:3001/fr/login (après npm run dev:admin)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
