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
import {
  defaultIconKeyForCategory,
  FEED_INGREDIENTS_SEED
} from "./seed-data/feed-ingredients";
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
    const iconKey = row.iconKey ?? defaultIconKeyForCategory(row.category);
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
        isPremix: row.isPremix ?? false,
        notes: row.notes ?? null,
        iconKey,
        imageUrl: row.imageUrl ?? null,
        isActive: true
      },
      update: {
        // Structurelle : propager isPremix + pictogramme catégorie (sans écraser imageUrl admin).
        ...(row.isPremix ? { isPremix: true } : {}),
        iconKey
      }
    });
  }
  console.log(
    `[seed] FeedIngredient : ${FEED_INGREDIENTS_SEED.length} entrées (upsert canonicalName, isPremix/iconKey seed)`
  );
}

async function resolveFixedInclusions(
  byName: { canonicalName: string; inclusionPct: number }[]
): Promise<{ feedIngredientId: string; inclusionPct: number }[]> {
  const out: { feedIngredientId: string; inclusionPct: number }[] = [];
  for (const item of byName) {
    const ing = await prisma.feedIngredient.findUnique({
      where: { canonicalName: item.canonicalName }
    });
    if (!ing) {
      console.warn(
        `[seed] Taux fixe ignoré — intrant introuvable : ${item.canonicalName}`
      );
      continue;
    }
    out.push({ feedIngredientId: ing.id, inclusionPct: item.inclusionPct });
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
      // Remplir fixedInclusions uniquement s'ils sont encore vides (ne pas écraser admin).
      const current = existing.fixedInclusions;
      const empty =
        current == null ||
        (Array.isArray(current) && current.length === 0);
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
