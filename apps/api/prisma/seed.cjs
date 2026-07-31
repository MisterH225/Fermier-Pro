/**
 * Seed référentiels géo CI + FeedIngredient + FeedRequirementProfile — CJS.
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
const FEED_REQUIREMENTS_SEED = require("./seed-data/feed-requirements.json");

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
        isPremix: Boolean(row.isPremix),
        notes: row.notes ?? null,
        isActive: true
      },
      update: row.isPremix ? { isPremix: true } : {}
    });
  }
  console.log(
    `[seed] FeedIngredient : ${FEED_INGREDIENTS_SEED.length} entrées (upsert canonicalName, isPremix seed)`
  );
}

async function resolveFixedInclusions(byName) {
  const out = [];
  for (const item of byName || []) {
    const ing = await prisma.feedIngredient.findUnique({
      where: { canonicalName: item.canonicalName }
    });
    if (!ing) {
      console.warn(
        `[seed] Taux fixe ignoré — intrant introuvable : ${item.canonicalName}`
      );
      continue;
    }
    out.push({
      feedIngredientId: ing.id,
      inclusionPct: item.inclusionPct
    });
  }
  return out;
}

async function seedFeedRequirements() {
  for (const row of FEED_REQUIREMENTS_SEED) {
    const fixedInclusions = await resolveFixedInclusions(
      row.fixedInclusionsByName
    );
    const existing = await prisma.feedRequirementProfile.findUnique({
      where: { stage: row.stage }
    });
    if (!existing) {
      await prisma.feedRequirementProfile.create({
        data: {
          stage: row.stage,
          minCrudeProteinPct: row.minCrudeProteinPct,
          maxCrudeProteinPct: row.maxCrudeProteinPct ?? null,
          minMetabolizableEnergyKcal: row.minMetabolizableEnergyKcal,
          maxMetabolizableEnergyKcal: row.maxMetabolizableEnergyKcal ?? null,
          minLysinePct: row.minLysinePct,
          minMethioninePct: row.minMethioninePct,
          minCalciumPct: row.minCalciumPct,
          maxCalciumPct: row.maxCalciumPct ?? null,
          minPhosphorusPct: row.minPhosphorusPct,
          maxFiberPct: row.maxFiberPct ?? null,
          minLysinePerMcal: row.minLysinePerMcal ?? null,
          targetDailyIntakeKg: row.targetDailyIntakeKg ?? null,
          fixedInclusions,
          notes: row.notes,
          isActive: true
        }
      });
    } else {
      const current = existing.fixedInclusions;
      const empty =
        current == null || (Array.isArray(current) && current.length === 0);
      if (empty && fixedInclusions.length > 0) {
        await prisma.feedRequirementProfile.update({
          where: { id: existing.id },
          data: { fixedInclusions }
        });
      }
    }
  }
  console.log(
    `[seed] FeedRequirementProfile : ${FEED_REQUIREMENTS_SEED.length} stades (taux fixes CMV/sel si vides)`
  );
}

async function main() {
  await seedAdminRegions();
  await seedLocalities();
  await seedFeedIngredients();
  await seedFeedRequirements();
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
