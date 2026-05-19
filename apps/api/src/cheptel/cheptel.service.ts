import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { LivestockExitKind, Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FinanceService } from "../finance/finance.service";
import { PrismaService } from "../prisma/prisma.service";
import { PatchAnimalStatusDto } from "../livestock/dto/patch-animal-status.dto";
import { LivestockService } from "../livestock/livestock.service";
import { UpsertGmqSettingsDto } from "./dto/upsert-gmq-settings.dto";
import { decimalToNum, summarizeWeights } from "./cheptel-gmq.util";

export type CheptelPenOverviewRow = {
  id: string;
  name: string;
  code: string | null;
  barnId: string;
  barnName: string;
  capacity: number;
  occupancy: number;
  occupancyRate: number | null;
  borderStatus: "healthy" | "warning" | "critical" | "empty";
  batchTypeTag: "starter" | "fattening" | null;
  sanitaryTag: "healthy" | "alert" | "critical" | "overcrowded" | "empty";
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

  async listPens(user: User, farmId: string, barnId?: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
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
            animal: { select: { id: true, status: true } },
            batch: { select: { headcount: true, categoryKey: true } }
          }
        }
      }
    });

    const rows: CheptelPenOverviewRow[] = pens.map((pen) => {
      let occupancy = 0;
      let batchTypeTag: "starter" | "fattening" | null = null;
      for (const pl of pen.placements) {
        if (pl.animalId) {
          occupancy += 1;
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
      } else if (cap > 0 && occupancy >= cap) {
        borderStatus = "critical";
        sanitaryTag = "overcrowded";
      } else if (cap > 0 && occupancy / cap > 0.8) {
        borderStatus = "warning";
        sanitaryTag = "alert";
      }

      return {
        id: pen.id,
        name: pen.name,
        code: pen.code,
        barnId: pen.barn.id,
        barnName: pen.barn.name,
        capacity: cap,
        occupancy,
        occupancyRate,
        borderStatus,
        batchTypeTag,
        sanitaryTag
      };
    });

    const barns = await this.prisma.barn.findMany({
      where: { farmId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    });

    return { barns, pens: rows };
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
}
