import {
  BadRequestException,
  Injectable,
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
import { PrismaService } from "../prisma/prisma.service";
import { PatchAnimalStatusDto } from "../livestock/dto/patch-animal-status.dto";
import { LivestockService } from "../livestock/livestock.service";
import { UpsertGmqSettingsDto } from "./dto/upsert-gmq-settings.dto";
import { decimalToNum, summarizeWeights } from "./cheptel-gmq.util";
import {
  migrateOnboardingBatchesToIndividualAnimals,
  normalizeFarmPenNaming,
  rebalanceOvercrowdedBatchPlacements,
  relocateBreederAnimalsToDefaultPlan,
  relocateProductionAnimalsToDefaultPlan
} from "../onboarding/onboarding-pen-layout";

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
  batchTypeTag: "starter" | "fattening" | null;
  sanitaryTag: "healthy" | "alert" | "critical" | "overcrowded" | "empty";
  category: PenCategory;
  categoryForced: boolean;
  usageTag:
    | "empty"
    | "sows"
    | "boar"
    | "boars"
    | "starter"
    | "fattening"
    | "mixed";
  maleCount: number;
  femaleCount: number;
  isActive: boolean;
  averageWeightKg: number | null;
  averageAgeDays: number | null;
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
    | "pen_created";
  occurredAt: string;
  title: string;
  subtitle: string | null;
  entityType: string | null;
  entityId: string | null;
  meta?: unknown;
};

@Injectable()
export class CheptelService {
  /** Évite deux migrations legacy concurrentes (ex. listPens + listPenContents). */
  private readonly legacyBatchMigrationFlights = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly livestock: LivestockService,
    private readonly finance: FinanceService
  ) {}

  private mapBatchType(
    categoryKey: string | null | undefined
  ): "starter" | "fattening" | null {
    const k = (categoryKey ?? "").toLowerCase();
    if (
      k.includes("nursery") ||
      k.includes("demarrage") ||
      k === "starter" ||
      k.includes("porcelet")
    ) {
      return "starter";
    }
    if (k.includes("finish") || k.includes("engrais") || k === "finisher") {
      return "fattening";
    }
    return null;
  }

  private detectPenUsageTag(params: {
    occupancy: number;
    hasGestationSow: boolean;
    batchTypeTag: "starter" | "fattening" | null;
    femaleCount: number;
    maleCount: number;
  }): CheptelPenOverviewRow["usageTag"] {
    if (params.occupancy === 0) {
      return "empty";
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
    batchTypeTag: "starter" | "fattening" | null,
    avgWeightKg: number | null,
    usageTag: CheptelPenOverviewRow["usageTag"]
  ): PenCategory {
    if (occupancy === 0) {
      return PenCategory.empty;
    }
    if (usageTag === "sows" || hasGestationSow) {
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
    await this.migrateLegacyBatchPlacementsIfNeeded(user, farmId);
    const now = new Date();
    const gestationSoon = new Date(now);
    gestationSoon.setDate(gestationSoon.getDate() + 7);

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
                sex: true,
                expectedFarrowingAt: true,
                weights: {
                  orderBy: { measuredAt: "desc" },
                  take: 1,
                  select: { weightKg: true }
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
      let occupancy = 0;
      let batchTypeTag: "starter" | "fattening" | null = null;
      let vaccineOverdueCount = 0;
      let gestationImminent = false;
      let hasGestationSow = false;
      let femaleCount = 0;
      let maleCount = 0;
      const weights: number[] = [];

      for (const pl of pen.placements) {
        if (pl.animalId && pl.animal) {
          occupancy += 1;
          if (pl.animal.sex === "female") {
            femaleCount += 1;
          } else if (pl.animal.sex === "male") {
            maleCount += 1;
          }
          vaccineOverdueCount += vaccineOverdueByAnimal.get(pl.animal.id) ?? 0;
          const w = pl.animal.weights[0];
          if (w) {
            weights.push(decimalToNum(w.weightKg));
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
          occupancy += pl.batch.headcount;
          const tag = this.mapBatchType(pl.batch.categoryKey);
          if (tag) {
            batchTypeTag = tag;
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
      const averageAgeDays = pen.averageAgeDays ?? null;

      const usageTag = this.detectPenUsageTag({
        occupancy,
        hasGestationSow,
        batchTypeTag,
        femaleCount,
        maleCount
      });
      const autoCategory = this.detectPenCategory(
        occupancy,
        hasGestationSow,
        batchTypeTag,
        averageWeightKg,
        usageTag
      );
      const category =
        pen.categoryForced && pen.category ? pen.category : autoCategory;

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
        averageAgeDays,
        vaccineOverdueCount,
        gestationImminent,
        activeDiseaseCount: 0
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
    dto: { averageWeightKg?: number | null; averageAgeDays?: number | null }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const pen = await this.prisma.pen.findFirst({
      where: { id: penId, barn: { farmId } }
    });
    if (!pen) {
      throw new NotFoundException("Loge introuvable");
    }
    return this.prisma.pen.update({
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
        ...(dto.averageAgeDays !== undefined
          ? { averageAgeDays: dto.averageAgeDays }
          : {})
      }
    });
  }

  async listPenContents(user: User, farmId: string, penId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.migrateLegacyBatchPlacementsIfNeeded(user, farmId);
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
      .filter((p) => p.animal)
      .map((p) => {
        const a = p.animal!;
        const latest = a.weights[0];
        const activeGestation = a.gestationsAsSow[0] ?? null;
        return {
          id: a.id,
          publicId: a.publicId,
          tagCode: a.tagCode,
          sex: a.sex,
          productionCategory: a.productionCategory,
          status: a.status,
          photoUrl: a.photoUrl,
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

    const batches = batchPlacements
      .filter((p) => p.batch)
      .map((p) => {
        const b = p.batch!;
        const latestWeight = b.weights[0];
        return {
          id: b.id,
          publicId: b.publicId,
          name: b.name,
          headcount: b.headcount,
          categoryKey: b.categoryKey,
          status: b.status,
          species: b.species,
          breed: b.breed,
          avgWeightKg: latestWeight
            ? decimalToNum(latestWeight.avgWeightKg)
            : null
        };
      });

    return { animals, batches };
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
        weights: { orderBy: { measuredAt: "asc" } }
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
      const sum = summarizeWeights(
        points,
        a.entryWeightKg != null ? decimalToNum(a.entryWeightKg) : null
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
    const animal = await this.livestock.patchAnimalStatus(
      user,
      farmId,
      animalId,
      dto
    );

    if (dto.status === "sold" && dto.salePrice != null && dto.salePrice > 0) {
      const tag = animal?.tagCode ?? animalId.slice(0, 8);
      await this.finance.createRevenue(user, farmId, {
        amount: dto.salePrice,
        label: `Vente animal ${tag}`,
        category: "livestock_sale",
        note: dto.note ?? undefined,
        linkedEntityType: "animal",
        linkedEntityId: animalId
      });
      await this.prisma.livestockExit.create({
        data: {
          farmId,
          animalId,
          kind: LivestockExitKind.sale,
          recordedByUserId: user.id,
          headcountAffected: 1,
          buyerName: dto.buyerName ?? null,
          price: new Prisma.Decimal(dto.salePrice),
          currency: "XOF",
          note: dto.note ?? null
        }
      });
    }

    if (dto.status === "dead") {
      await this.prisma.livestockExit.create({
        data: {
          farmId,
          animalId,
          kind: LivestockExitKind.mortality,
          recordedByUserId: user.id,
          headcountAffected: 1,
          deathCause: dto.deathCause ?? dto.note ?? null,
          note: dto.note ?? null
        }
      });
    }

    await this.prisma.animal.update({
      where: { id: animalId },
      data: { statusChangedAt: new Date() }
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
            buildingsCount
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
  private migrateLegacyBatchPlacementsIfNeeded(
    user: User,
    farmId: string
  ): Promise<void> {
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

  private async runLegacyBatchMigration(
    user: User,
    farmId: string
  ): Promise<void> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { housingBuildingsCount: true, speciesFocus: true }
    });

    const species = await this.prisma.species.findFirst({
      where: { code: farm?.speciesFocus ?? "porcin" }
    });
    if (!species) {
      return;
    }

    const buildingsCount = farm?.housingBuildingsCount ?? 2;

    await this.prisma.$transaction(
      async (tx) => {
        const legacyBatchCount = await tx.penPlacement.count({
          where: {
            endedAt: null,
            batchId: { not: null },
            pen: { barn: { farmId } },
            batch: { is: { headcount: { gt: 0 } } }
          }
        });
        if (legacyBatchCount === 0) {
          return;
        }

        const migrated = await migrateOnboardingBatchesToIndividualAnimals(
          tx,
          farmId,
          species.id,
          user.id
        );
        if (migrated > 0) {
          await relocateProductionAnimalsToDefaultPlan(tx, {
            farmId,
            userId: user.id,
            buildingsCount
          });
        }
      },
      { maxWait: 10_000, timeout: 60_000 }
    );
  }
}
