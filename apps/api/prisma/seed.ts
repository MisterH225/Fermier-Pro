/**
 * Seed référentiels géo CI (AdminRegionRef + LocalityRef)
 * + référentiel FeedIngredient (intrants, valeurs indicatives)
 * + profils FeedRequirementProfile (besoins par stade).
 * Usage : npm run prisma:seed --workspace @fermier/api
 */
import * as path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { CI_ADMIN_REGIONS } from "./seed-data/ci-admin-regions";
import { CI_LOCALITIES } from "./seed-data/ci-localities";
import { FEED_INGREDIENTS_SEED } from "./seed-data/feed-ingredients";
import { FEED_REQUIREMENTS_SEED } from "./seed-data/feed-requirements";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function seedAdminRegions() {
  // Ordre : districts → régions → départements (FK parent)
  const order = ["district", "region", "department"] as const;
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
      update: {
        // Idempotent : ne pas écraser les corrections superadmin déjà en base.
        // Seuls les champs absents à la création sont garantis ; on met à jour
        // aliases / notes / nutrition uniquement si l'intrant est encore « seed ».
        // Politique : ne touche PAS les valeurs si la ligne existe déjà.
      }
    });
  }
  console.log(
    `[seed] FeedIngredient : ${FEED_INGREDIENTS_SEED.length} entrées (upsert canonicalName, sans écraser l'existant)`
  );
}

async function seedFeedRequirements() {
  for (const row of FEED_REQUIREMENTS_SEED) {
    await prisma.feedRequirementProfile.upsert({
      where: { stage: row.stage },
      create: {
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
        notes: row.notes,
        isActive: true
      },
      // Idempotent : ne pas écraser les corrections superadmin.
      update: {}
    });
  }
  console.log(
    `[seed] FeedRequirementProfile : ${FEED_REQUIREMENTS_SEED.length} stades (upsert stage, sans écraser l'existant)`
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
