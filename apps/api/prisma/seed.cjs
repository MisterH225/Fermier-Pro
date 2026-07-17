/**
 * Seed référentiels géo CI (AdminRegionRef + LocalityRef) — CJS pour Railway.
 * Usage : node prisma/seed.cjs
 */
const path = require("node:path");
const { config: loadEnv } = require("dotenv");
const { PrismaClient } = require("@prisma/client");

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const CI_ADMIN_REGIONS = require("./seed-data/ci-admin-regions.json");
const CI_LOCALITIES = require("./seed-data/ci-localities.json");

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

async function main() {
  await seedAdminRegions();
  await seedLocalities();
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
