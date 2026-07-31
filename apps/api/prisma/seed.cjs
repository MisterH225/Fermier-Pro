/**
 * Seed référentiels géo CI + FeedIngredient — CJS pour Railway.
 * Usage : node prisma/seed.cjs
 */
const path = require("node:path");
const { config: loadEnv } = require("dotenv");
const { PrismaClient } = require("@prisma/client");

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const CI_ADMIN_REGIONS = require("./seed-data/ci-admin-regions.json");
const CI_LOCALITIES = require("./seed-data/ci-localities.json");
const FEED_INGREDIENTS_SEED = require("./seed-data/feed-ingredients.json");

const prisma = new PrismaClient();

async function seedAdminRegions() {
  const order = ["district", "region", "department"];
  for (const level of order) {
    const rows = CI_ADMIN_REGIONS.filter((r) => r.level === level);
    for (const row of rows) {
      await prisma.adminRegionRef.upsert({
        where: { code: row.code },
        create: {
          code: row.code,
          name: row.name,
          level: row.level,
          parentCode: row.parentCode
        },
        update: {
          name: row.name,
          level: row.level,
          parentCode: row.parentCode
        }
      });
    }
  }
  console.log(`[seed] AdminRegionRef : ${CI_ADMIN_REGIONS.length} entrées`);
}

async function seedLocalities() {
  for (const loc of CI_LOCALITIES) {
    await prisma.localityRef.upsert({
      where: { id: loc.id },
      create: {
        id: loc.id,
        nameNormalized: loc.nameNormalized,
        displayName: loc.displayName,
        departmentCode: loc.departmentCode,
        latitude: loc.latitude,
        longitude: loc.longitude
      },
      update: {
        nameNormalized: loc.nameNormalized,
        displayName: loc.displayName,
        departmentCode: loc.departmentCode,
        latitude: loc.latitude,
        longitude: loc.longitude
      }
    });
  }
  console.log(`[seed] LocalityRef : ${CI_LOCALITIES.length} entrées`);
}

async function seedFeedIngredients() {
  for (const row of FEED_INGREDIENTS_SEED) {
    await prisma.feedIngredient.upsert({
      where: { canonicalName: row.canonicalName },
      create: {
        canonicalName: row.canonicalName,
        aliases: row.aliases,
        category: row.category,
        crudeProteinPct: row.crudeProteinPct,
        metabolizableEnergyKcal: row.metabolizableEnergyKcal,
        lysinePct: row.lysinePct,
        methioninePct: row.methioninePct,
        calciumPct: row.calciumPct,
        phosphorusPct: row.phosphorusPct,
        crudeFiberPct: row.crudeFiberPct,
        fatPct: row.fatPct,
        dryMatterPct: row.dryMatterPct,
        notes: row.notes ?? null,
        isActive: true
      },
      update: {}
    });
  }
  console.log(
    `[seed] FeedIngredient : ${FEED_INGREDIENTS_SEED.length} entrées (upsert canonicalName, sans écraser l'existant)`
  );
}

async function main() {
  await seedAdminRegions();
  await seedLocalities();
  await seedFeedIngredients();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
