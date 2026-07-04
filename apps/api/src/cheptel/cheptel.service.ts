import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmHealthEntityType,
  FarmHealthRecordKind,
  GestationStatus,
  LivestockExitKind,
  PenCategory,
  Prisma
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FinanceService } from "../finance/finance.service";
import { mapBatchTypeTag } from "./batch-category.util";
import { maintainLitterBatches } from "../gestation/litter-weaning.util";
import { countPlacementOccupancyFromRows } from "../housing/placement-occupancy.util";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizeAnimalLifecycleStatus,
  PatchAnimalStatusDto
} from "../livestock/dto/patch-animal-status.dto";
import { LivestockService } from "../livestock/livestock.service";
import { ConfirmDetectedBatchDto } from "./dto/confirm-detected-batch.dto";
import { UpsertGmqSettingsDto } from "./dto/upsert-gmq-settings.dto";
import { SellAnimalDto } from "./dto/sell-animal.dto";
import { ListingAnimalSyncService } from "../marketplace/listing-animal-sync.service";
import { decimalToNum, summarizeWeights } from "./cheptel-gmq.util";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import {
  applyBatchHeadcountOnAnimalExit,
  endActiveAnimalPenPlacements,
  repairOrphanMigrationDuplicateAnimals
} from "../livestock/livestock-batch-headcount.helper";
import {
  migrateOnboardingBatchesToIndividualAnimals,
  normalizeFarmPenNaming,
  rebalanceOvercrowdedBatchPlacements,
  relocateBreederAnimalsToDefaultPlan,
  relocateProductionAnimalsToDefaultPlan
} from "../onboarding/onboarding-pen-layout";
import { AgeCalculationService } from "./age-calculation.service";
import type { PenAgeData } from "./age-calculation.types";
import { calculateAnimalAgeWeeks } from "./age-calculation.util";
import {
  buildGrowthStandardsFromFarm,
  estimateAnimalWeightKg
} from "./growth-estimation.util";
import { PenAllocationService } from "../housing/pen-allocation.service";
import { effectiveBatchHeadcount } from "../livestock/livestock-batch-membership.util";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";

export type CheptelPenOverviewRow = {
  id: string;
  name: string;
  code: string | null;
  barnId: string;
  barnName: string;
  sortOrder: number;
  capacity: number;
  occupancy: number;
  occupancyRate: number | null;
  borderStatus: "healthy" | "warning" | "critical" | "empty";
  batchTypeTag: "sous_mere" | "starter" | "fattening" | null;
  sanitaryTag: "healthy" | "alert" | "critical" | "overcrowded" | "empty";
  category: PenCategory;
  categoryForced: boolean;
  usageTag:
    | "empty"
    | "sows"
    | "boar"
    | "boars"
    | "nursing"
    | "starter"
    | "fattening"
    | "mixed";
  maleCount: number;
  femaleCount: number;
  isActive: boolean;
  averageWeightKg: number | null;
  ageData: PenAgeData;
  vaccineOverdueCount: number;
  gestationImminent: boolean;
  activeDiseaseCount: number;
};

export type CheptelHistoryItem = {
  id: string;
  type:
    | "status"
    | "weight"
    | "transfer"
    | "creation"
    | "pen_created"
    | "sold";
  occurredAt: string;
  title: string;
  subtitle: string | null;
  entityType: string | null;
  entityId: string | null;
  meta?: unknown;
};

export type LegacyBatchMigrationResult = {
  legacyBatchCount: number;
  animalsMigrated: number;
  duplicatesArchived: number;
  productionAnimalsRelocated: number;
};

@Injectable()
export class CheptelService {
  /** Évite deux migrations legacy concurrentes (ex. maintain-data appelé en double). */
  private readonly legacyBatchMigrationFlights = new Map<
    string,
    Promise<LegacyBatchMigrationResult>
  >();
  private readonly duplicateRepairFlights = new Map<string, Promise<number>>();

  private readonly logger = new Logger(CheptelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly livestock: LivestockService,
    private readonly finance: FinanceService,
    private readonly penAllocation: PenAllocationService,
    private readonly ageCalculation: AgeCalculationService,
    @Inject(forwardRef(() => SmartAlertsService))
    private readonly smartAlerts: SmartAlertsService,
    @Inject(forwardRef(() => ListingAnimalSyncService))
    private readonly listingAnimalSync: ListingAnimalSyncService
  ) {}

  private resolvePenCategoryForDisplay(
    pen: { category: PenCategory | null; categoryForced: boolean },
    autoCategory: PenCategory
  ): PenCategory {
    if (pen.categoryForced && pen.category) {
      return pen.category;
    }
    const stored = pen.category;
    if (
      stored &&
      stored !== PenCategory.mixed &&
      stored !== PenCategory.empty &&
      autoCategory === PenCategory.mixed
    ) {
      return stored;
    }
    return autoCategory;
  }

  private detectPenUsageTag(params: {
    occupancy: number;
    hasGestationSow: boolean;
    batchTypeTag: "sous_mere" | "starter" | "fattening" | null;
    femaleCount: number;
    maleCount: number;
    allocationRoles: Set<string>;
  }): CheptelPenOverviewRow["usageTag"] {
    if (params.occupancy === 0) {
      return "empty";
    }
    if (params.allocationRoles.size > 1) {
      return "mixed";
    }
    if (
      params.batchTypeTag === "sous_mere" &&
      params.femaleCount === 0 &&
      params.maleCount === 0
    ) {
      return "nursing";
    }
    if (
      params.batchTypeTag === "fattening" &&
      params.femaleCount === 0 &&
      params.maleCount === 0
    ) {
      return "fattening";
    }
    if (
      params.batchTypeTag === "starter" &&
      params.femaleCount === 0 &&
      params.maleCount === 0
    ) {
      return "starter";
    }
    if (params.allocationRoles.size === 1) {
      const [only] = [...params.allocationRoles];
      if (only === "fattening") {
        return "fattening";
      }
      if (only === "sous_mere") {
        return "nursing";
      }
      if (only === "starter") {
        return "starter";
      }
      if (only === "breeding_female") {
        return "sows";
      }
      if (only === "breeding_male") {
        return params.maleCount > 1 ? "boars" : "boar";
      }
    }
    if (params.femaleCount > 0 && params.maleCount === 0) {
      return "sows";
    }
    if (params.maleCount === 1 && params.femaleCount === 0) {
      return "boar";
    }
    if (params.maleCount > 1 && params.femaleCount === 0) {
      return "boars";
    }
    if (params.hasGestationSow) {
      return "sows";
    }
    return "mixed";
  }

  private detectPenCategory(
    occupancy: number,
    hasGestationSow: boolean,
    batchTypeTag: "sous_mere" | "starter" | "fattening" | null,
    avgWeightKg: number | null,
    usageTag: CheptelPenOverviewRow["usageTag"]
  ): PenCategory {
    if (occupancy === 0) {
      return PenCategory.empty;
    }
    if (
      usageTag === "sows" ||
      usageTag === "nursing" ||
      hasGestationSow ||
      batchTypeTag === "sous_mere"
    ) {
      return PenCategory.maternity;
    }
    if (usageTag === "fattening" || batchTypeTag === "fattening") {
      return PenCategory.fattening;
    }
    if (usageTag === "starter" || batchTypeTag === "starter") {
      return PenCategory.starter;
    }
    if (avgWeightKg != null && avgWeightKg < 30) {
      return PenCategory.starter;
    }
    if (avgWeightKg != null && avgWeightKg >= 30) {
      return PenCategory.fattening;
    }
    return PenCategory.mixed;
  }

  async listPens(user: User, farmId: string, barnId?: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
    const gestationSoon = new Date(now);
    gestationSoon.setDate(gestationSoon.getDate() + 7);

    const [profitability, alertSettings, gmqRows] = await Promise.all([
      this.prisma.farmProfitabilitySettings.findUnique({ where: { farmId } }),
      this.prisma.farmAlertSettings.findUnique({ where: { farmId } }),
      this.prisma.farmGmqSettings.findMany({ where: { farmId } })
    ]);
    const gmqByKey = new Map(gmqRows.map((r) => [r.categoryKey, r]));
    const growthStandards = buildGrowthStandardsFromFarm({
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

    const pens = await this.prisma.pen.findMany({
      where: {
        barn: {
          farmId,
          ...(barnId ? { id: barnId } : {})
        }
      },
      orderBy: [
        { barn: { sortOrder: "asc" } },
        { barn: { name: "asc" } },
        { sortOrder: "asc" },
        { name: "asc" }
      ],
      include: {
        barn: { select: { id: true, name: true } },
        placements: {
          where: { endedAt: null },
          include: {
            animal: {
              select: {
                id: true,
                status: true,
                healthStatus: true,
                sex: true,
                tagCode: true,
                productionCategory: true,
                birthDate: true,
                ageWeeksAtEntry: true,
                entryDate: true,
                entryWeightKg: true,
                expectedFarrowingAt: true,
                livestockBatch: {
                  select: { categoryKey: true }
                },
                weights: {
                  orderBy: { measuredAt: "desc" },
                  take: 1,
                  select: { weightKg: true, measuredAt: true }
                },
                gestationsAsSow: {
                  where: { status: GestationStatus.active },
                  take: 1,
                  select: { id: true, expectedBirthDate: true }
                }
              }
            },
            batch: { select: { headcount: true, categoryKey: true } }
          }
        }
      }
    });

    const animalIds = pens.flatMap((pen) =>
      pen.placements
        .map((pl) => pl.animal?.id)
        .filter((id): id is string => Boolean(id))
    );

    const vaccineOverdueByAnimal = new Map<string, number>();
    if (animalIds.length > 0) {
      const overdueRecords = await this.prisma.farmHealthRecord.findMany({
        where: {
          farmId,
          entityType: FarmHealthEntityType.animal,
          entityId: { in: animalIds },
          kind: FarmHealthRecordKind.vaccination,
          vaccination: { is: { nextReminderAt: { lt: now } } }
        },
        select: { entityId: true }
      });
      for (const rec of overdueRecords) {
        vaccineOverdueByAnimal.set(
          rec.entityId,
          (vaccineOverdueByAnimal.get(rec.entityId) ?? 0) + 1
        );
      }
    }

    const rows: CheptelPenOverviewRow[] = pens.map((pen) => {
      const occupancy = countPlacementOccupancyFromRows(
        pen.placements.map((pl) => ({
          animalId: pl.animalId,
          animal: pl.animal ? { status: pl.animal.status } : null,
          batch: pl.batch ? { headcount: pl.batch.headcount } : null
        }))
      );
      let batchTypeTag: "sous_mere" | "starter" | "fattening" | null = null;
      let vaccineOverdueCount = 0;
      let activeDiseaseCount = 0;
      let gestationImminent = false;
      let hasGestationSow = false;
      let femaleCount = 0;
      let maleCount = 0;
      const weights: number[] = [];
      const ageAnimals: Array<{
        birthDate: Date | null;
        ageWeeksAtEntry: number | null;
        entryDate: Date | null;
      }> = [];
      const allocationRoles = new Set<string>();

      for (const pl of pen.placements) {
        if (pl.animalId && pl.animal) {
          if (pl.animal.status !== "active") {
            continue;
          }
          ageAnimals.push({
            birthDate: pl.animal.birthDate,
            ageWeeksAtEntry: pl.animal.ageWeeksAtEntry,
            entryDate: pl.animal.entryDate
          });
          const role = PenAllocationService.roleFromAnimal(pl.animal);
          if (role) {
            allocationRoles.add(role);
          }
          const litterBatchTag = pl.animal.livestockBatch
            ? mapBatchTypeTag(pl.animal.livestockBatch.categoryKey)
            : null;
          const tagPrefix = (pl.animal.tagCode ?? "").trim().slice(0, 3).toLowerCase();
          if (litterBatchTag === "sous_mere" || tagPrefix === "all") {
            batchTypeTag = "sous_mere";
            allocationRoles.add("sous_mere");
          }
          if (pl.animal.sex === "female") {
            femaleCount += 1;
          } else if (pl.animal.sex === "male") {
            maleCount += 1;
          }
          vaccineOverdueCount += vaccineOverdueByAnimal.get(pl.animal.id) ?? 0;
          if (pl.animal.healthStatus === "sick") {
            activeDiseaseCount += 1;
          }
          const w = pl.animal.weights[0];
          if (w) {
            weights.push(decimalToNum(w.weightKg));
          } else {
            const estimated = estimateAnimalWeightKg(
              {
                birthDate: pl.animal.birthDate,
                ageWeeksAtEntry: pl.animal.ageWeeksAtEntry,
                entryDate: pl.animal.entryDate,
                entryWeightKg: pl.animal.entryWeightKg
                  ? decimalToNum(pl.animal.entryWeightKg)
                  : null,
                productionCategory: pl.animal.productionCategory
              },
              now,
              growthStandards
            );
            if (estimated != null) {
              weights.push(estimated);
            }
          }
          const g = pl.animal.gestationsAsSow[0];
          if (g || pl.animal.expectedFarrowingAt) {
            hasGestationSow = true;
            const due =
              g?.expectedBirthDate ?? pl.animal.expectedFarrowingAt;
            if (due && due <= gestationSoon) {
              gestationImminent = true;
            }
          }
        } else if (pl.batch) {
          const tag = mapBatchTypeTag(pl.batch.categoryKey);
          if (tag) {
            batchTypeTag = tag;
            allocationRoles.add(tag);
          }
        }
      }

      const cap = pen.capacity ?? 0;
      const occupancyRate =
        cap > 0 ? Math.round((occupancy / cap) * 1000) / 10 : null;

      let borderStatus: CheptelPenOverviewRow["borderStatus"] = "healthy";
      let sanitaryTag: CheptelPenOverviewRow["sanitaryTag"] = "healthy";

      if (occupancy === 0) {
        borderStatus = "empty";
        sanitaryTag = "empty";
      } else if (allocationRoles.size > 1) {
        borderStatus = "warning";
        sanitaryTag = "alert";
      } else if (activeDiseaseCount > 0) {
        borderStatus = "warning";
        sanitaryTag = "alert";
      } else if (vaccineOverdueCount > 0) {
        borderStatus = "critical";
        sanitaryTag = "critical";
      } else if (cap > 0 && occupancy >= cap) {
        borderStatus = "critical";
        sanitaryTag = "overcrowded";
      } else if (cap > 0 && occupancy / cap > 0.8) {
        borderStatus = "warning";
        sanitaryTag = "alert";
      }

      const computedAvg =
        weights.length > 0
          ? Math.round(
              (weights.reduce((a, b) => a + b, 0) / weights.length) * 10
            ) / 10
          : null;
      const averageWeightKg =
        pen.averageWeightKg != null
          ? decimalToNum(pen.averageWeightKg)
          : computedAvg;
      const ageData = this.ageCalculation.buildPenAgeDataFromAnimals(
        ageAnimals,
        pen.averageAgeWeeksManual ?? null,
        now
      );

      const usageTag = this.detectPenUsageTag({
        occupancy,
        hasGestationSow,
        batchTypeTag,
        femaleCount,
        maleCount,
        allocationRoles
      });
      const autoCategory = this.detectPenCategory(
        occupancy,
        hasGestationSow,
        batchTypeTag,
        averageWeightKg,
        usageTag
      );
      const category = this.resolvePenCategoryForDisplay(pen, autoCategory);

      return {
        id: pen.id,
        name: pen.name,
        code: pen.code,
        barnId: pen.barn.id,
        barnName: pen.barn.name,
        sortOrder: pen.sortOrder,
        capacity: cap,
        occupancy,
        occupancyRate,
        borderStatus,
        batchTypeTag,
        sanitaryTag,
        category,
        categoryForced: pen.categoryForced,
        usageTag,
        maleCount,
        femaleCount,
        isActive: pen.status !== "inactive",
        averageWeightKg,
        ageData,
        vaccineOverdueCount,
        gestationImminent,
        activeDiseaseCount
      };
    });

    const barns = await this.prisma.barn.findMany({
      where: { farmId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, sortOrder: true }
    });

    return { barns, pens: rows, totalPens: rows.length };
  }

  async togglePenActive(user: User, farmId: string, penId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const pen = await this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } }
    });
    if (!pen) {
      throw new NotFoundException("Loge introuvable");
    }
    const next = pen.status === "inactive" ? "active" : "inactive";
    return this.prisma.pen.update({
      where: { id: penId },
      data: { status: next }
    });
  }

  async patchPenAverages(
    user: User,
    farmId: string,
    penId: string,
    dto: {
      averageWeightKg?: number | null;
      averageAgeWeeksManual?: number | null;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const pen = await this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } }
    });
    if (!pen) {
      throw new NotFoundException("Loge introuvable");
    }
    const updated = await this.prisma.pen.update({
      where: { id: penId },
      data: {
        ...(dto.averageWeightKg !== undefined
          ? {
              averageWeightKg:
                dto.averageWeightKg == null
                  ? null
                  : new Prisma.Decimal(dto.averageWeightKg)
            }
          : {}),
        ...(dto.averageAgeWeeksManual !== undefined
          ? { averageAgeWeeksManual: dto.averageAgeWeeksManual }
          : {})
      }
    });
    if (
      dto.averageWeightKg !== undefined ||
      dto.averageAgeWeeksManual !== undefined
    ) {
      void this.smartAlerts
        .refreshInternal(farmId)
        .catch((e) => this.logger.warn(`SmartAlerts refresh after pen averages failed`, e));
    }
    return updated;
  }

  async listPenContents(user: User, farmId: string, penId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const pen = await this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } }
    });
    if (!pen) {
      throw new NotFoundException("Loge introuvable");
    }
    const now = new Date();

    const animalPlacements = await this.prisma.penPlacement.findMany({
      where: { penId, endedAt: null, animalId: { not: null } },
      include: {
        animal: {
          include: {
            breed: { select: { id: true, name: true } },
            species: { select: { id: true, code: true, name: true } },
            weights: { orderBy: { measuredAt: "desc" }, take: 3 },
            gestationsAsSow: {
              where: { status: GestationStatus.active },
              take: 1,
              select: { id: true, expectedBirthDate: true }
            }
          }
        }
      }
    });

    const batchPlacements = await this.prisma.penPlacement.findMany({
      where: { penId, endedAt: null, batchId: { not: null } },
      include: {
        batch: {
          include: {
            breed: { select: { id: true, name: true } },
            species: { select: { id: true, code: true, name: true } },
            weights: { orderBy: { measuredAt: "desc" }, take: 1 }
          }
        }
      }
    });

    const animalIds = animalPlacements
      .map((p) => p.animal?.id)
      .filter((id): id is string => Boolean(id));

    const overdueAnimalIds = new Set<string>();
    if (animalIds.length > 0) {
      const recs = await this.prisma.farmHealthRecord.findMany({
        where: {
          farmId,
          entityType: FarmHealthEntityType.animal,
          entityId: { in: animalIds },
          kind: FarmHealthRecordKind.vaccination,
          vaccination: { is: { nextReminderAt: { lt: now } } }
        },
        select: { entityId: true }
      });
      for (const r of recs) {
        overdueAnimalIds.add(r.entityId);
      }
    }

    const animals = animalPlacements
      .filter((p) => p.animal && p.animal.status === "active")
      .map((p) => {
        const a = p.animal!;
        const latest = a.weights[0];
        const activeGestation = a.gestationsAsSow[0] ?? null;
        const currentAgeWeeks = calculateAnimalAgeWeeks(
          {
            birthDate: a.birthDate,
            ageWeeksAtEntry: a.ageWeeksAtEntry,
            entryDate: a.entryDate
          },
          now
        );
        return {
          id: a.id,
          publicId: a.publicId,
          tagCode: a.tagCode,
          sex: a.sex,
          productionCategory: a.productionCategory,
          status: a.status,
          healthStatus: a.healthStatus,
          photoUrl: a.photoUrl,
          birthDate: a.birthDate?.toISOString().slice(0, 10) ?? null,
          ageWeeksAtEntry: a.ageWeeksAtEntry,
          entryDate: a.entryDate?.toISOString().slice(0, 10) ?? null,
          currentAgeWeeks,
          species: a.species,
          breed: a.breed,
          weights: a.weights.map((w) => ({
            weightKg: decimalToNum(w.weightKg),
            measuredAt: w.measuredAt.toISOString()
          })),
          currentWeightKg: latest ? decimalToNum(latest.weightKg) : null,
          vaccineOverdue: overdueAnimalIds.has(a.id),
          activeGestation: activeGestation
            ? {
                id: activeGestation.id,
                expectedFarrowingAt:
                  activeGestation.expectedBirthDate?.toISOString() ?? null
              }
            : null
        };
      });

    const activeMemberCountByBatch = new Map<string, number>();
    for (const p of animalPlacements) {
      const a = p.animal;
      if (!a || a.status !== "active" || !a.livestockBatchId) {
        continue;
      }
      activeMemberCountByBatch.set(
        a.livestockBatchId,
        (activeMemberCountByBatch.get(a.livestockBatchId) ?? 0) + 1
      );
    }

    const batches = batchPlacements
      .filter((p) => p.batch)
      .map((p) => {
        const b = p.batch!;
        const activeMemberCount = activeMemberCountByBatch.get(b.id) ?? 0;
        const latestWeight = b.weights[0];
        return {
          id: b.id,
          publicId: b.publicId,
          name: b.name,
          headcount: effectiveBatchHeadcount(b.headcount, activeMemberCount),
          activeMemberCount,
          categoryKey: b.categoryKey,
          status: b.status,
          species: b.species,
          breed: b.breed,
          avgWeightKg: latestWeight
            ? decimalToNum(latestWeight.avgWeightKg)
            : null
        };
      });

    const ageData = await this.ageCalculation.calculatePenAverageAgeWeeks(
      penId,
      now
    );

    return { animals, batches, ageData };
  }

  /** @deprecated Préférer listPenContents — conservé pour alertes vaccins. */
  async listPenAnimals(user: User, farmId: string, penId: string) {
    const contents = await this.listPenContents(user, farmId, penId);
    return contents.animals;
  }

  async getPenVaccineAlerts(user: User, farmId: string, penId: string) {
    const animals = await this.listPenAnimals(user, farmId, penId);
    return {
      overdueCount: animals.filter((a) => a.vaccineOverdue).length,
      animals: animals
        .filter((a) => a.vaccineOverdue)
        .map((a) => ({
          id: a.id,
          tagCode: a.tagCode,
          publicId: a.publicId
        }))
    };
  }

  async listHistory(
    user: User,
    farmId: string,
    query: { type?: string; limit?: number }
  ): Promise<CheptelHistoryItem[]> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const take = Math.min(Math.max(query.limit ?? 200, 1), 500);
    const typeFilter = query.type?.trim();

    const items: CheptelHistoryItem[] = [];

    if (!typeFilter || typeFilter === "status") {
      const logs = await this.prisma.livestockStatusLog.findMany({
        where: { farmId },
        orderBy: { createdAt: "desc" },
        take
      });
      for (const r of logs) {
        items.push({
          id: `status-${r.id}`,
          type: "status",
          occurredAt: r.createdAt.toISOString(),
          title: `${r.oldStatus ?? "—"} → ${r.newStatus}`,
          subtitle: `${r.entityType}`,
          entityType: r.entityType,
          entityId: r.entityId,
          meta: r
        });
      }
    }

    if (!typeFilter || typeFilter === "weight") {
      const weights = await this.prisma.animalWeight.findMany({
        where: { animal: { farmId } },
        orderBy: { measuredAt: "desc" },
        take,
        include: {
          animal: { select: { id: true, tagCode: true, publicId: true } }
        }
      });
      for (const w of weights) {
        const tag = w.animal.tagCode ?? w.animal.publicId.slice(0, 8);
        items.push({
          id: `weight-${w.id}`,
          type: "weight",
          occurredAt: w.measuredAt.toISOString(),
          title: `Pesée · ${tag}`,
          subtitle: `${decimalToNum(w.weightKg).toFixed(1)} kg`,
          entityType: "animal",
          entityId: w.animalId,
          meta: w
        });
      }
    }

    if (!typeFilter || typeFilter === "transfer") {
      const placements = await this.prisma.penPlacement.findMany({
        where: { pen: { barn: { farmId } } },
        orderBy: { startedAt: "desc" },
        take,
        include: {
          pen: { select: { name: true, barn: { select: { name: true } } } },
          animal: { select: { id: true, tagCode: true, publicId: true } },
          batch: { select: { id: true, name: true } }
        }
      });
      for (const p of placements) {
        const label =
          p.animal?.tagCode ??
          p.batch?.name ??
          p.animal?.publicId?.slice(0, 8) ??
          "—";
        items.push({
          id: `placement-${p.id}`,
          type: "transfer",
          occurredAt: p.startedAt.toISOString(),
          title: `Placement · ${label}`,
          subtitle: `${p.pen.barn.name} · ${p.pen.name}`,
          entityType: p.animalId ? "animal" : "batch",
          entityId: p.animalId ?? p.batchId,
          meta: p
        });
      }
    }

    if (!typeFilter || typeFilter === "sold") {
      const sales = await this.prisma.livestockExit.findMany({
        where: {
          farmId,
          kind: LivestockExitKind.sale,
          animalId: { not: null }
        },
        orderBy: { occurredAt: "desc" },
        take,
        include: {
          animal: {
            select: {
              id: true,
              tagCode: true,
              publicId: true,
              breed: { select: { name: true } },
              productionCategory: true,
              buyerName: true,
              soldAt: true,
              soldPrice: true,
              soldCurrency: true,
              penPlacements: {
                where: { endedAt: { not: null } },
                orderBy: { endedAt: "desc" },
                take: 1,
                include: {
                  pen: {
                    select: {
                      name: true,
                      barn: { select: { name: true } }
                    }
                  }
                }
              }
            }
          }
        }
      });
      for (const s of sales) {
        const a = s.animal;
        if (!a) {
          continue;
        }
        const tag = a.tagCode ?? a.publicId.slice(0, 8);
        const pen = a.penPlacements[0];
        const penLabel = pen
          ? `${pen.pen.barn.name} · ${pen.pen.name}`
          : null;
        const priceLabel =
          s.price != null
            ? `${decimalToNum(s.price).toLocaleString("fr-FR")} ${s.currency ?? ""}`.trim()
            : null;
        items.push({
          id: `sold-${s.id}`,
          type: "sold",
          occurredAt: s.occurredAt.toISOString(),
          title: `💰 Vendu · ${tag}`,
          subtitle: [a.breed?.name, penLabel, priceLabel]
            .filter(Boolean)
            .join(" · "),
          entityType: "animal",
          entityId: a.id,
          meta: { exit: s, animal: a }
        });
      }
    }

    if (!typeFilter || typeFilter === "creation") {
      const animals = await this.prisma.animal.findMany({
        where: { farmId },
        orderBy: { createdAt: "desc" },
        take: Math.floor(take / 2),
        select: {
          id: true,
          tagCode: true,
          publicId: true,
          createdAt: true,
          sex: true
        }
      });
      for (const a of animals) {
        items.push({
          id: `animal-create-${a.id}`,
          type: "creation",
          occurredAt: a.createdAt.toISOString(),
          title: `Création animal · ${a.tagCode ?? a.publicId.slice(0, 8)}`,
          subtitle: a.sex,
          entityType: "animal",
          entityId: a.id,
          meta: a
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    return items.slice(0, take);
  }

  async getGmqSummary(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const animals = await this.prisma.animal.findMany({
      where: { farmId, status: "active" },
      select: {
        id: true,
        tagCode: true,
        publicId: true,
        entryWeightKg: true,
        entryDate: true,
        weights: { orderBy: { measuredAt: "asc" } },
        penPlacements: {
          where: { endedAt: null },
          take: 1,
          select: {
            pen: { select: { averageWeightKg: true } }
          }
        }
      }
    });

    const settings = await this.prisma.farmGmqSettings.findMany({
      where: { farmId }
    });
    const defaultTarget = settings.find((s) => s.categoryKey === "finishing");

    const rows = animals.map((a) => {
      const points = a.weights.map((w) => ({
        weightKg: decimalToNum(w.weightKg),
        measuredAt: w.measuredAt
      }));
      const penAvg =
        a.penPlacements[0]?.pen?.averageWeightKg != null
          ? decimalToNum(a.penPlacements[0].pen.averageWeightKg)
          : null;
      const sum = summarizeWeights(
        points,
        a.entryWeightKg != null ? decimalToNum(a.entryWeightKg) : null,
        {
          penAverageWeightKg: penAvg,
          entryDate: a.entryDate
        }
      );
      const targetGmq =
        defaultTarget?.targetGmqGPerDay != null
          ? decimalToNum(defaultTarget.targetGmqGPerDay)
          : null;
      const alertTh =
        defaultTarget?.alertThresholdGmq != null
          ? decimalToNum(defaultTarget.alertThresholdGmq)
          : null;
      let status: "ok" | "warn" | "critical" = "ok";
      if (sum.latestGmq != null && targetGmq != null) {
        if (sum.latestGmq < (alertTh ?? targetGmq * 0.7)) {
          status = "critical";
        } else if (sum.latestGmq < targetGmq) {
          status = "warn";
        }
      }
      return {
        animalId: a.id,
        label: a.tagCode ?? a.publicId.slice(0, 10),
        ...sum,
        targetGmqGPerDay: targetGmq,
        targetSaleWeightKg:
          defaultTarget?.targetSaleWeightKg != null
            ? decimalToNum(defaultTarget.targetSaleWeightKg)
            : null,
        status
      };
    });

    return { animals: rows, settings };
  }

  async getGmqSettings(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.farmGmqSettings.findMany({
      where: { farmId },
      orderBy: { categoryKey: "asc" }
    });
  }

  async upsertGmqSettings(
    user: User,
    farmId: string,
    dto: UpsertGmqSettingsDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.categories) {
        await tx.farmGmqSettings.upsert({
          where: {
            farmId_categoryKey: {
              farmId,
              categoryKey: row.categoryKey
            }
          },
          create: {
            farmId,
            categoryKey: row.categoryKey,
            targetGmqGPerDay:
              row.targetGmqGPerDay != null
                ? new Prisma.Decimal(row.targetGmqGPerDay)
                : null,
            targetSaleWeightKg:
              row.targetSaleWeightKg != null
                ? new Prisma.Decimal(row.targetSaleWeightKg)
                : null,
            alertThresholdGmq:
              row.alertThresholdGmq != null
                ? new Prisma.Decimal(row.alertThresholdGmq)
                : null
          },
          update: {
            targetGmqGPerDay:
              row.targetGmqGPerDay != null
                ? new Prisma.Decimal(row.targetGmqGPerDay)
                : null,
            targetSaleWeightKg:
              row.targetSaleWeightKg != null
                ? new Prisma.Decimal(row.targetSaleWeightKg)
                : null,
            alertThresholdGmq:
              row.alertThresholdGmq != null
                ? new Prisma.Decimal(row.alertThresholdGmq)
                : null
          }
        });
      }
    });
    return this.getGmqSettings(user, farmId);
  }

  async sellAnimal(
    user: User,
    farmId: string,
    animalId: string,
    dto: SellAnimalDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);

    const soldAt = new Date(dto.soldAt);
    if (Number.isNaN(soldAt.getTime())) {
      throw new BadRequestException("Date de vente invalide");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const animal = await tx.animal.findFirst({
        where: { id: animalId, farmId },
        include: {
          breed: { select: { name: true } },
          penPlacements: {
            where: { endedAt: null },
            select: { id: true, penId: true }
          }
        }
      });
      if (!animal) {
        throw new NotFoundException("Animal introuvable");
      }
      if (animal.status !== "active") {
        throw new BadRequestException(
          "Seul un animal actif peut être vendu"
        );
      }

      const finSettings = await tx.farmFinanceSettings.findUnique({
        where: { farmId }
      });
      const currency = finSettings?.currencyCode ?? "XOF";
      const financeCat = await tx.financeCategory.findFirst({
        where: { farmId, key: "animal_sales" }
      });

      const tag = animal.tagCode ?? animal.publicId.slice(0, 8);
      const breedName = animal.breed?.name ?? "—";
      const label = `Vente ${tag} — ${breedName} — ${dto.soldWeightKg}kg`;
      const noteParts = [dto.notes?.trim()].filter(Boolean);
      if (dto.buyerName?.trim()) {
        noteParts.push(`Acheteur : ${dto.buyerName.trim()}`);
      }

      await tx.animal.update({
        where: { id: animalId },
        data: {
          status: "sold",
          statusChangedAt: soldAt,
          soldAt,
          soldWeightKg: new Prisma.Decimal(dto.soldWeightKg),
          soldPrice: new Prisma.Decimal(dto.totalPrice),
          soldCurrency: currency,
          buyerName: dto.buyerName?.trim() || null
        }
      });

      await tx.livestockStatusLog.create({
        data: {
          farmId,
          recordedByUserId: user.id,
          entityType: "animal",
          entityId: animalId,
          oldStatus: animal.status,
          newStatus: "sold",
          note: [
            label,
            `${dto.totalPrice} ${currency}`,
            dto.buyerName?.trim()
          ]
            .filter(Boolean)
            .join(" · ")
        }
      });

      for (const pl of animal.penPlacements) {
        await tx.penPlacement.update({
          where: { id: pl.id },
          data: { endedAt: soldAt }
        });
      }

      const penIds = animal.penPlacements.map((pl) => pl.penId).filter(Boolean);
      const batchIdForExit = await applyBatchHeadcountOnAnimalExit(tx, {
        farmId,
        animalId,
        livestockBatchId: animal.livestockBatchId,
        penIds,
        endedAt: soldAt
      });

      await tx.livestockExit.create({
        data: {
          farmId,
          animalId,
          batchId: batchIdForExit,
          kind: LivestockExitKind.sale,
          occurredAt: soldAt,
          recordedByUserId: user.id,
          headcountAffected: 1,
          buyerName: dto.buyerName?.trim() || null,
          price: new Prisma.Decimal(dto.totalPrice),
          currency,
          weightKg: new Prisma.Decimal(dto.soldWeightKg),
          note: noteParts.join(" · ") || null
        }
      });

      const revenue = await tx.farmRevenue.create({
        data: {
          farmId,
          amount: new Prisma.Decimal(dto.totalPrice),
          currency,
          label,
          category: "animal_sales",
          financeCategoryId: financeCat?.id ?? null,
          note: noteParts.join(" · ") || null,
          occurredAt: soldAt,
          createdByUserId: user.id,
          linkedEntityType: "animal",
          linkedEntityId: animalId,
          isAutoGenerated: true
        }
      });

      return { transaction: revenue };
    });

    const animal = await this.livestock.getAnimal(user, farmId, animalId);
    try {
      await this.listingAnimalSync.onAnimalSoldViaCheptel(animalId);
    } catch (e) {
      this.logger.warn(
        `marketplace sync after cheptel sell ${animalId}: ${(e as Error).message}`
      );
    }
    return { animal, transaction: result.transaction };
  }

  async patchAnimalStatusWithLinks(
    user: User,
    farmId: string,
    animalId: string,
    dto: PatchAnimalStatusDto & {
      salePrice?: number;
      buyerName?: string;
      deathCause?: string;
    }
  ) {
    if (dto.status === "sold") {
      throw new BadRequestException(
        "Utilisez PATCH /cheptel/animals/:id/sell pour enregistrer une vente"
      );
    }

    const status = normalizeAnimalLifecycleStatus(dto.status);
    const normalizedDto = { ...dto, status };

    const animal = await this.livestock.patchAnimalStatus(
      user,
      farmId,
      animalId,
      normalizedDto
    );

    const occurredAt = new Date();
    const herdExitStatuses = new Set(["exited", "dead", "transferred"]);

    if (herdExitStatuses.has(status)) {
      let batchIdForExit: string | null = null;
      await this.prisma.$transaction(async (tx) => {
        const animalRow = await tx.animal.findFirst({
          where: { id: animalId, farmId },
          select: { livestockBatchId: true }
        });
        const penIds = await endActiveAnimalPenPlacements(tx, {
          farmId,
          animalId,
          endedAt: occurredAt
        });
        for (const penId of penIds) {
          await this.penAllocation.recalculatePenCategory(tx, penId);
          await this.penAllocation.recalculatePenAverageWeight(tx, penId);
        }
        batchIdForExit = await applyBatchHeadcountOnAnimalExit(tx, {
          farmId,
          animalId,
          livestockBatchId: animalRow?.livestockBatchId ?? null,
          penIds,
          endedAt: occurredAt
        });
        await tx.animal.update({
          where: { id: animalId },
          data: { statusChangedAt: occurredAt }
        });
      });

      if (status === "exited") {
        await this.prisma.livestockExit.create({
          data: {
            farmId,
            animalId,
            batchId: batchIdForExit,
            kind: LivestockExitKind.slaughter,
            occurredAt,
            recordedByUserId: user.id,
            headcountAffected: 1,
            note: dto.note ?? null
          }
        });
        try {
          await this.listingAnimalSync.onAnimalExitedFromCheptel(animalId);
        } catch (e) {
          this.logger.warn(
            `marketplace sync after cheptel exit ${animalId}: ${(e as Error).message}`
          );
        }
        return this.livestock.getAnimal(user, farmId, animalId);
      }

      if (status === "dead") {
        await this.prisma.livestockExit.create({
          data: {
            farmId,
            animalId,
            batchId: batchIdForExit,
            kind: LivestockExitKind.mortality,
            recordedByUserId: user.id,
            headcountAffected: 1,
            deathCause: dto.deathCause ?? dto.note ?? null,
            note: dto.note ?? null,
            occurredAt
          }
        });
      }

      if (status === "transferred") {
        await this.prisma.livestockExit.create({
          data: {
            farmId,
            animalId,
            batchId: batchIdForExit,
            kind: LivestockExitKind.transfer,
            occurredAt,
            recordedByUserId: user.id,
            headcountAffected: 1,
            note: dto.note ?? null
          }
        });
      }

      return this.livestock.getAnimal(user, farmId, animalId);
    }

    await this.prisma.animal.update({
      where: { id: animalId },
      data: { statusChangedAt: occurredAt }
    });

    return animal;
  }

  async getWeightSeries(
    user: User,
    farmId: string,
    query: { animalId?: string; months?: number }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const months = Math.min(Math.max(query.months ?? 6, 1), 12);
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const where: Prisma.AnimalWeightWhereInput = {
      animal: { farmId },
      measuredAt: { gte: since }
    };
    if (query.animalId) {
      where.animalId = query.animalId;
    }

    const rows = await this.prisma.animalWeight.findMany({
      where,
      orderBy: { measuredAt: "asc" },
      include: {
        animal: { select: { id: true, tagCode: true, publicId: true } }
      }
    });

    return rows.map((w) => ({
      id: w.id,
      animalId: w.animalId,
      animalLabel: w.animal.tagCode ?? w.animal.publicId.slice(0, 8),
      weightKg: decimalToNum(w.weightKg),
      measuredAt: w.measuredAt.toISOString(),
      note: w.note
    }));
  }

  /**
   * Réapplique le plan de répartition onboarding pour les sujets/lots sans loge active.
   * Utile si l'onboarding a été complété avant l'activation des placements automatiques.
   */
  async fixPenAllocation(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.penAllocation.fixFarmPenAllocation(farmId, user.id);
  }

  async applyDefaultPenLayout(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        housingBuildingsCount: true,
        housingPensPerBuilding: true,
        speciesFocus: true
      }
    });
    if (!farm?.housingBuildingsCount || !farm.housingPensPerBuilding) {
      throw new BadRequestException(
        "Configuration des loges introuvable sur cette ferme"
      );
    }
    const buildingsCount = farm.housingBuildingsCount;

    const species = await this.prisma.species.findFirst({
      where: { code: farm.speciesFocus ?? "porcin" }
    });
    if (!species) {
      throw new BadRequestException("Espèce porcin indisponible");
    }

    const penCount = await this.prisma.pen.count({
      where: { barn: { farmId } }
    });
    if (penCount === 0) {
      throw new BadRequestException("Aucune loge sur cette ferme");
    }

    return this.prisma.$transaction(
      async (tx) => {
        await normalizeFarmPenNaming(tx, farmId);
        await tx.pen.updateMany({
          where: { barn: { farmId } },
          data: { categoryForced: false }
        });

        const batchesMigrated =
          await migrateOnboardingBatchesToIndividualAnimals(
            tx,
            farmId,
            species.id,
            user.id
          );
        const breedersPlaced = await relocateBreederAnimalsToDefaultPlan(
          tx,
          farmId,
          user.id,
          buildingsCount
        );
        const productionPlaced = await relocateProductionAnimalsToDefaultPlan(
          tx,
          {
            farmId,
            userId: user.id,
            buildingsCount,
            resetAll: true
          }
        );
        const rebalanced = await rebalanceOvercrowdedBatchPlacements(
          tx,
          farmId,
          user.id,
          species.id
        );
        return {
          batchesMigrated,
          breedersPlaced,
          productionPlaced,
          rebalanced
        };
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
  }

  /** Lots onboarding legacy (bande) → sujets Dem-/Eng- individuels. */
  migrateLegacyBatchPlacements(
    user: User,
    farmId: string
  ): Promise<LegacyBatchMigrationResult> {
    const inFlight = this.legacyBatchMigrationFlights.get(farmId);
    if (inFlight) {
      return inFlight;
    }

    const flight = this.runLegacyBatchMigration(user, farmId).finally(() => {
      this.legacyBatchMigrationFlights.delete(farmId);
    });
    this.legacyBatchMigrationFlights.set(farmId, flight);
    return flight;
  }

  /**
   * Réparations non destructives : portées matérialisées + doublons migration.
   * La migration legacy / réaffectation globale reste sur POST apply-default-layout
   * ou POST migrate-legacy-batches.
   */
  async maintainCheptelData(user: User, farmId: string): Promise<{
    litterMaintenanceRan: true;
    legacyMigration: LegacyBatchMigrationResult;
    duplicatesArchived: number;
  }> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await maintainLitterBatches(this.prisma, farmId);
    const duplicatesArchived = await this.repairDuplicateAnimalsIfNeeded(
      user,
      farmId
    );
    return {
      litterMaintenanceRan: true,
      legacyMigration: {
        legacyBatchCount: 0,
        animalsMigrated: 0,
        duplicatesArchived: 0,
        productionAnimalsRelocated: 0
      },
      duplicatesArchived
    };
  }

  /** Archive les doublons fictifs (migration onboarding) cohabitant avec une bande confirmée. */
  repairDuplicateAnimalsIfNeeded(user: User, farmId: string): Promise<number> {
    void user;
    const inFlight = this.duplicateRepairFlights.get(farmId);
    if (inFlight) {
      return inFlight;
    }
    const flight = this.prisma
      .$transaction(async (tx) => repairOrphanMigrationDuplicateAnimals(tx, farmId))
      .finally(() => {
        this.duplicateRepairFlights.delete(farmId);
      });
    this.duplicateRepairFlights.set(farmId, flight);
    return flight;
  }

  async repairDuplicateAnimals(user: User, farmId: string): Promise<{ archived: number }> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const archived = await this.repairDuplicateAnimalsIfNeeded(user, farmId);
    return { archived };
  }

  private async runLegacyBatchMigration(
    user: User,
    farmId: string
  ): Promise<LegacyBatchMigrationResult> {
    const empty: LegacyBatchMigrationResult = {
      legacyBatchCount: 0,
      animalsMigrated: 0,
      duplicatesArchived: 0,
      productionAnimalsRelocated: 0
    };

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { housingBuildingsCount: true, speciesFocus: true }
    });

    const species = await this.prisma.species.findFirst({
      where: { code: farm?.speciesFocus ?? "porcin" }
    });
    if (!species) {
      return empty;
    }

    return this.prisma.$transaction(
      async (tx) => {
        const legacyBatchCount = await tx.penPlacement.count({
          where: {
            endedAt: null,
            batchId: { not: null },
            pen: { barn: { farmId } },
            batch: {
              is: {
                headcount: { gt: 0 },
                NOT: {
                  OR: [
                    { sourceTag: { startsWith: "gestation:" } },
                    { categoryKey: "sous_mere" }
                  ]
                }
              }
            }
          }
        });
        if (legacyBatchCount === 0) {
          return empty;
        }

        const animalsMigrated = await migrateOnboardingBatchesToIndividualAnimals(
          tx,
          farmId,
          species.id,
          user.id
        );
        const duplicatesArchived = await repairOrphanMigrationDuplicateAnimals(
          tx,
          farmId
        );
        if (duplicatesArchived > 0) {
          this.logger.log(
            `Ferme ${farmId}: ${duplicatesArchived} doublon(s) migration archivé(s)`
          );
        }
        return {
          legacyBatchCount,
          animalsMigrated,
          duplicatesArchived,
          productionAnimalsRelocated: 0
        };
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
  }

  async detectPotentialBatches(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
    const animals = await this.prisma.animal.findMany({
      where: {
        farmId,
        status: "active",
        livestockBatchId: null,
        productionCategory: { in: ["starter", "fattening"] }
      },
      select: {
        id: true,
        tagCode: true,
        publicId: true,
        productionCategory: true,
        entryWeightKg: true,
        birthDate: true,
        ageWeeksAtEntry: true,
        entryDate: true,
        weights: { orderBy: { measuredAt: "desc" }, take: 1 },
        penPlacements: {
          where: { endedAt: null },
          take: 1,
          select: {
            penId: true,
            pen: { select: { name: true, averageWeightKg: true } }
          }
        }
      }
    });

    type Enriched = {
      id: string;
      label: string;
      category: string;
      ageWeeks: number | null;
      weightKg: number | null;
      penId: string | null;
      penName: string | null;
    };

    const enriched: Enriched[] = animals.map((a) => {
      const ageWeeks = calculateAnimalAgeWeeks(
        {
          birthDate: a.birthDate,
          ageWeeksAtEntry: a.ageWeeksAtEntry,
          entryDate: a.entryDate
        },
        now
      );
      let weightKg = a.weights[0]
        ? decimalToNum(a.weights[0].weightKg)
        : null;
      if (!weightKg && a.penPlacements[0]?.pen?.averageWeightKg) {
        weightKg = decimalToNum(a.penPlacements[0].pen.averageWeightKg);
      }
      if (!weightKg && a.entryWeightKg) {
        weightKg = decimalToNum(a.entryWeightKg);
      }
      return {
        id: a.id,
        label: a.tagCode ?? a.publicId.slice(0, 8),
        category: a.productionCategory,
        ageWeeks,
        weightKg,
        penId: a.penPlacements[0]?.penId ?? null,
        penName: a.penPlacements[0]?.pen?.name ?? null
      };
    });

    const monthLabels = [
      "Jan",
      "Fev",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Aou",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];
    const monthTag = `${monthLabels[now.getMonth()]}${now.getFullYear()}`;
    const batches: Array<{
      id: string;
      name: string;
      category: string;
      headcount: number;
      avgAgeWeeks: number | null;
      avgWeightKg: number | null;
      penNames: string[];
      animalIds: string[];
    }> = [];

    const byCategory = new Map<string, Enriched[]>();
    for (const e of enriched) {
      const arr = byCategory.get(e.category) ?? [];
      arr.push(e);
      byCategory.set(e.category, arr);
    }

    for (const [category, group] of byCategory) {
      const used = new Set<string>();
      for (const seed of group) {
        if (used.has(seed.id)) {
          continue;
        }
        const members = group.filter((m) => {
          if (used.has(m.id)) {
            return false;
          }
          if (
            m.ageWeeks != null &&
            seed.ageWeeks != null &&
            Math.abs(m.ageWeeks - seed.ageWeeks) > 2
          ) {
            return false;
          }
          if (
            m.weightKg != null &&
            seed.weightKg != null &&
            Math.abs(m.weightKg - seed.weightKg) > 5
          ) {
            return false;
          }
          return true;
        });
        if (members.length < 2) {
          continue;
        }
        members.forEach((m) => used.add(m.id));
        const ages = members
          .map((m) => m.ageWeeks)
          .filter((x): x is number => x != null);
        const weights = members
          .map((m) => m.weightKg)
          .filter((x): x is number => x != null);
        const catLabel = category === "fattening" ? "Eng" : "Dem";
        batches.push({
          id: `detected-${category}-${members[0].id}`,
          name: `Bande ${catLabel}-${monthTag}`,
          category,
          headcount: members.length,
          avgAgeWeeks: ages.length
            ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
            : null,
          avgWeightKg: weights.length
            ? Math.round(
                (weights.reduce((a, b) => a + b, 0) / weights.length) * 10
              ) / 10
            : null,
          penNames: [
            ...new Set(
              members.map((m) => m.penName).filter((n): n is string => Boolean(n))
            )
          ],
          animalIds: members.map((m) => m.id)
        });
      }
    }

    return { farmId, batches };
  }

  async confirmDetectedBatch(
    user: User,
    farmId: string,
    dto: ConfirmDetectedBatchDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    const uniqueIds = [...new Set(dto.animalIds)];
    const animals = await this.prisma.animal.findMany({
      where: {
        id: { in: uniqueIds },
        farmId,
        status: "active",
        livestockBatchId: null,
        productionCategory: { in: ["starter", "fattening"] }
      },
      select: {
        id: true,
        speciesId: true,
        breedId: true,
        birthDate: true,
        ageWeeksAtEntry: true,
        entryDate: true,
        productionCategory: true,
        entryWeightKg: true,
        weights: { orderBy: { measuredAt: "desc" }, take: 1 }
      }
    });

    if (animals.length !== uniqueIds.length) {
      throw new BadRequestException(
        "Un ou plusieurs sujets sont introuvables ou déjà rattachés à une bande"
      );
    }

    const mismatched = animals.filter(
      (a) => a.productionCategory !== dto.category
    );
    if (mismatched.length > 0) {
      throw new BadRequestException(
        "Tous les sujets doivent appartenir à la même catégorie (démarrage ou engraissement)"
      );
    }

    const now = new Date();
    let avgBirthDate: Date | null = dto.avgBirthDate
      ? new Date(dto.avgBirthDate)
      : null;
    if (!avgBirthDate) {
      const birthDates = animals
        .map((a) => {
          if (a.birthDate) {
            return a.birthDate;
          }
          const ageWeeks = calculateAnimalAgeWeeks(
            {
              birthDate: a.birthDate,
              ageWeeksAtEntry: a.ageWeeksAtEntry,
              entryDate: a.entryDate
            },
            now
          );
          if (ageWeeks == null) {
            return null;
          }
          const d = new Date(now);
          d.setUTCDate(d.getUTCDate() - ageWeeks * 7);
          return d;
        })
        .filter((d): d is Date => d != null);
      if (birthDates.length > 0) {
        const avgMs =
          birthDates.reduce((s, d) => s + d.getTime(), 0) / birthDates.length;
        avgBirthDate = new Date(avgMs);
      }
    }

    const weights = animals
      .map((a) => {
        if (a.weights[0]) {
          return decimalToNum(a.weights[0].weightKg);
        }
        if (a.entryWeightKg) {
          return decimalToNum(a.entryWeightKg);
        }
        return null;
      })
      .filter((w): w is number => w != null);
    const avgWeightKg =
      weights.length > 0
        ? Math.round(
            (weights.reduce((a, b) => a + b, 0) / weights.length) * 10
          ) / 10
        : null;

    const speciesId = animals[0].speciesId;
    const breedIds = [...new Set(animals.map((a) => a.breedId).filter(Boolean))];
    const breedId = breedIds.length === 1 ? breedIds[0] : null;

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.livestockBatch.create({
        data: {
          farmId,
          speciesId,
          breedId,
          name: dto.name.trim(),
          categoryKey: dto.category,
          headcount: animals.length,
          avgBirthDate,
          sourceTag: "detected:legacy",
          notes: dto.notes?.trim() || null
        }
      });

      await tx.animal.updateMany({
        where: { id: { in: uniqueIds } },
        data: { livestockBatchId: created.id }
      });

      if (avgWeightKg != null) {
        await tx.livestockBatchWeight.create({
          data: {
            batchId: created.id,
            avgWeightKg: new Prisma.Decimal(avgWeightKg),
            headcountSnapshot: animals.length,
            note: "Poids moyen estimé à la création de la bande"
          }
        });
      }

      return created;
    });

    return {
      batch,
      animalIds: uniqueIds,
      avgWeightKg
    };
  }
}
