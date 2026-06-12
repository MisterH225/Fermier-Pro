import { Injectable, Logger } from "@nestjs/common";
import { AnimalProductionCategory, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PenAllocationService } from "../housing/pen-allocation.service";
import {
  retagAnimalsInTransaction,
  tagPrefixFromCode
} from "../livestock/retag-animals.util";
import {
  buildGrowthStandardsFromFarm,
  estimateAnimalWeightKg,
  resolveAutoProductionCategory
} from "./growth-estimation.util";

@Injectable()
export class GrowthSimulationService {
  private readonly log = new Logger(GrowthSimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly penAllocation: PenAllocationService
  ) {}

  private async loadStandards(farmId: string) {
    const [profitability, alertSettings, gmqRows] = await Promise.all([
      this.prisma.farmProfitabilitySettings.findUnique({ where: { farmId } }),
      this.prisma.farmAlertSettings.findUnique({ where: { farmId } }),
      this.prisma.farmGmqSettings.findMany({ where: { farmId } })
    ]);

    const gmqByKey = new Map(gmqRows.map((r) => [r.categoryKey, r]));

    return buildGrowthStandardsFromFarm({
      gmqRefStarter: profitability?.gmqRefStarter,
      gmqRefGrowth: profitability?.gmqRefGrowth,
      gmqRefFattening: profitability?.gmqRefFattening,
      gmqTargetStarter: gmqByKey.get("starter")?.targetGmqGPerDay?.toNumber(),
      gmqTargetGrowth: gmqByKey.get("growth")?.targetGmqGPerDay?.toNumber(),
      gmqTargetFattening:
        gmqByKey.get("finishing")?.targetGmqGPerDay?.toNumber() ??
        gmqByKey.get("fattening")?.targetGmqGPerDay?.toNumber(),
      starterMaxAvgWeightKg: alertSettings?.starterMaxAvgWeightKg?.toNumber(),
      starterMaxAvgAgeWeeks: alertSettings?.starterMaxAvgAgeWeeks
    });
  }

  /**
   * Simule la croissance hebdomadaire : met à jour les poids moyens de loge,
   * reclasse starter → engraissement et bandes associées.
   */
  async runForFarm(farmId: string): Promise<{
    animalsReclassified: number;
    batchesReclassified: number;
    pensUpdated: number;
  }> {
    const standards = await this.loadStandards(farmId);
    const now = new Date();
    let animalsReclassified = 0;
    let batchesReclassified = 0;
    let pensUpdated = 0;

    const animals = await this.prisma.animal.findMany({
      where: {
        farmId,
        status: "active",
        productionCategory: { in: ["starter", "fattening"] }
      },
      select: {
        id: true,
        tagCode: true,
        productionCategory: true,
        birthDate: true,
        ageWeeksAtEntry: true,
        entryDate: true,
        entryWeightKg: true,
        livestockBatchId: true,
        weights: { orderBy: { measuredAt: "desc" }, take: 1 }
      }
    });

    const batchIdsToReclassify = new Set<string>();
    const animalsToRetagEng: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const a of animals) {
        const lastW = a.weights[0];
        const input = {
          birthDate: a.birthDate,
          ageWeeksAtEntry: a.ageWeeksAtEntry,
          entryDate: a.entryDate,
          entryWeightKg: a.entryWeightKg?.toNumber() ?? null,
          lastWeightKg: lastW ? lastW.weightKg.toNumber() : null,
          lastWeightAt: lastW?.measuredAt ?? null,
          productionCategory: a.productionCategory
        };

        const nextCat = resolveAutoProductionCategory(input, now, standards);
        if (nextCat === "fattening" && a.productionCategory === "starter") {
          animalsToRetagEng.push(a.id);
          await tx.animal.update({
            where: { id: a.id },
            data: { productionCategory: AnimalProductionCategory.fattening }
          });
          animalsReclassified += 1;
          if (a.livestockBatchId) {
            batchIdsToReclassify.add(a.livestockBatchId);
          }
        }
      }

      if (animalsToRetagEng.length > 0) {
        const idsForEng = animalsToRetagEng.filter((id) => {
          const row = animals.find((a) => a.id === id);
          if (!row) {
            return false;
          }
          const prefix = tagPrefixFromCode(row.tagCode);
          return prefix === "DEM" || prefix === null;
        });
        if (idsForEng.length > 0) {
          await retagAnimalsInTransaction(
            tx,
            farmId,
            idsForEng,
            "Eng",
            AnimalProductionCategory.fattening
          );
        }
      }

      for (const batchId of batchIdsToReclassify) {
        const batch = await tx.livestockBatch.findFirst({
          where: { id: batchId, farmId, categoryKey: "starter" }
        });
        if (batch) {
          await tx.livestockBatch.update({
            where: { id: batchId },
            data: { categoryKey: "fattening" }
          });
          batchesReclassified += 1;
        }
      }

      const pens = await tx.pen.findMany({
        where: { barn: { farmId }, status: "active" },
        select: {
          id: true,
          categoryForced: true,
          placements: {
            where: { endedAt: null, animalId: { not: null } },
            select: {
              animal: {
                select: {
                  status: true,
                  productionCategory: true,
                  birthDate: true,
                  ageWeeksAtEntry: true,
                  entryDate: true,
                  entryWeightKg: true,
                  weights: { orderBy: { measuredAt: "desc" }, take: 1 }
                }
              }
            }
          }
        }
      });

      for (const pen of pens) {
        const activeAnimals = pen.placements
          .map((p) => p.animal)
          .filter((a) => a && a.status === "active");
        if (activeAnimals.length === 0) {
          continue;
        }

        const estimated: number[] = [];
        for (const a of activeAnimals) {
          if (!a) continue;
          const lastW = a.weights[0];
          const w = estimateAnimalWeightKg(
            {
              birthDate: a.birthDate,
              ageWeeksAtEntry: a.ageWeeksAtEntry,
              entryDate: a.entryDate,
              entryWeightKg: a.entryWeightKg?.toNumber() ?? null,
              lastWeightKg: lastW ? lastW.weightKg.toNumber() : null,
              lastWeightAt: lastW?.measuredAt ?? null,
              productionCategory: a.productionCategory
            },
            now,
            standards
          );
          if (w != null) {
            estimated.push(w);
          }
        }

        if (estimated.length === 0) {
          continue;
        }

        const avg =
          Math.round(
            (estimated.reduce((s, x) => s + x, 0) / estimated.length) * 10
          ) / 10;

        await tx.pen.update({
          where: { id: pen.id },
          data: { averageWeightKg: new Prisma.Decimal(avg) }
        });
        pensUpdated += 1;

        if (!pen.categoryForced) {
          await this.penAllocation.recalculatePenCategory(tx, pen.id);
        }
      }
    });

    if (animalsReclassified > 0 || pensUpdated > 0) {
      this.log.log(
        `Farm ${farmId}: ${animalsReclassified} sujets reclassés, ${batchesReclassified} bandes, ${pensUpdated} loges mises à jour`
      );
    }

    return { animalsReclassified, batchesReclassified, pensUpdated };
  }

  async runForAllFarms(): Promise<void> {
    const farms = await this.prisma.farm.findMany({ select: { id: true } });
    for (const f of farms) {
      try {
        await this.runForFarm(f.id);
      } catch (e) {
        this.log.warn(`Growth sim farm ${f.id}: ${(e as Error).message}`);
      }
    }
  }
}
