import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { FeedMovementKind, FeedTypeUnit, Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { FinanceService } from "../finance/finance.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { CreateFeedMovementDto } from "./dto/create-feed-movement.dto";
import { CreateFeedTypeDto } from "./dto/create-feed-type.dto";
import { buildFeedStockStatsForFarm } from "./feed-stock-stats.helper";

const MS_PER_DAY = 86_400_000;

function daysBetweenUtc(a: Date, b: Date): number {
  const d = Math.round(
    (b.getTime() - a.getTime()) / MS_PER_DAY
  );
  return Math.max(1, d);
}

function monthEndsSliding(count: number): { key: string; end: Date }[] {
  const now = new Date();
  const out: { key: string; end: Date }[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const ref = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)
    );
    const end = new Date(
      Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    );
    const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ key, end });
  }
  return out;
}

function parsePeriod(raw?: string): 3 | 6 | 12 {
  if (raw === "3m" || raw === "3") return 3;
  if (raw === "12m" || raw === "12") return 12;
  return 6;
}

@Injectable()
export class FarmFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly finance: FinanceService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  async listTypes(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    return this.prisma.feedType.findMany({
      where: { farmId },
      orderBy: { name: "asc" }
    });
  }

  async createType(user: User, farmId: string, dto: CreateFeedTypeDto) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    return this.prisma.feedType.create({
      data: {
        farmId,
        name: dto.name.trim(),
        unit: dto.unit,
        color: dto.color?.trim() || "#5d7a1f",
        weightPerBagKg:
          dto.weightPerBagKg != null
            ? new Prisma.Decimal(dto.weightPerBagKg)
            : null,
        lowStockThresholdDays: dto.lowStockThresholdDays ?? 15
      }
    });
  }

  async overview(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const types = await this.prisma.feedType.findMany({
      where: { farmId },
      orderBy: { name: "asc" }
    });
    let total = new Prisma.Decimal(0);
    for (const t of types) {
      total = total.plus(t.currentStockKg);
    }
    return {
      farmId,
      totalStockKg: total.toString(),
      types
    };
  }

  async chart(user: User, farmId: string, periodRaw?: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const n = parsePeriod(periodRaw);
    const months = monthEndsSliding(n);
    const lastEnd = months[months.length - 1]?.end ?? new Date();

    const types = await this.prisma.feedType.findMany({
      where: { farmId },
      select: { id: true, name: true, color: true }
    });

    const movements = await this.prisma.feedStockMovement.findMany({
      where: { farmId, occurredAt: { lte: lastEnd } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      select: {
        feedTypeId: true,
        occurredAt: true,
        stockAfterKg: true
      }
    });

    const byType = new Map<string, typeof movements>();
    for (const m of movements) {
      const arr = byType.get(m.feedTypeId) ?? [];
      arr.push(m);
      byType.set(m.feedTypeId, arr);
    }

    const series = types.map((t) => {
      const arr = (byType.get(t.id) ?? []).slice();
      const points = months.map(({ end }) => {
        let v = 0;
        for (const m of arr) {
          if (m.occurredAt <= end) {
            v = m.stockAfterKg.toNumber();
          } else {
            break;
          }
        }
        return v;
      });
      return {
        feedTypeId: t.id,
        name: t.name,
        color: t.color,
        points
      };
    });

    return {
      farmId,
      periodMonths: n,
      monthKeys: months.map((m) => m.key),
      series
    };
  }

  private async feedAlertThresholds(farmId: string) {
    const s = await this.prisma.farmAlertSettings.findUnique({
      where: { farmId }
    });
    return {
      criticalDays: s?.stockCriticalDays ?? 15,
      warningDays: s?.stockWarningDays ?? 30
    };
  }

  private async statsForFarm(farmId: string) {
    const th = await this.feedAlertThresholds(farmId);
    return buildFeedStockStatsForFarm(this.prisma, farmId, th);
  }

  async stats(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    return { farmId, items: await this.statsForFarm(farmId) };
  }

  async listMovements(
    user: User,
    farmId: string,
    q: { feedTypeId?: string; from?: string; to?: string }
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const where: Prisma.FeedStockMovementWhereInput = { farmId };
    if (q.feedTypeId) {
      where.feedTypeId = q.feedTypeId;
    }
    if (q.from || q.to) {
      where.occurredAt = {};
      if (q.from) {
        where.occurredAt.gte = new Date(q.from);
      }
      if (q.to) {
        where.occurredAt.lte = new Date(q.to);
      }
    }
    return this.prisma.feedStockMovement.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        feedType: { select: { id: true, name: true, unit: true } }
      }
    });
  }

  private async resolveOrCreateFeedType(
    user: User,
    farmId: string,
    dto: CreateFeedMovementDto
  ) {
    if (dto.feedTypeId) {
      const row = await this.prisma.feedType.findFirst({
        where: { id: dto.feedTypeId, farmId }
      });
      if (!row) {
        throw new NotFoundException("Type d’aliment introuvable");
      }
      return row;
    }
    if (dto.newFeedType) {
      return this.createType(user, farmId, dto.newFeedType);
    }
    throw new BadRequestException("feedTypeId ou newFeedType requis");
  }

  private async financeFeedCategoryId(farmId: string) {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const cat = await this.prisma.financeCategory.findFirst({
      where: {
        farmId,
        type: "expense",
        key: "feed"
      }
    });
    return cat?.id ?? null;
  }

  async createMovement(
    user: User,
    farmId: string,
    dto: CreateFeedMovementDto
  ) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    let feedType = await this.resolveOrCreateFeedType(user, farmId, dto);
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt)
      : new Date();

    if (dto.kind === FeedMovementKind.in) {
      if (dto.quantityInput == null) {
        throw new BadRequestException("quantityInput requis pour une entrée");
      }
      const qUnit = dto.quantityUnit ?? feedType.unit;
      const wp =
        dto.weightPerBagKg != null
          ? new Prisma.Decimal(dto.weightPerBagKg)
          : feedType.weightPerBagKg;

      let deltaKg = new Prisma.Decimal(0);
      if (qUnit === FeedTypeUnit.sac) {
        if (!wp) {
          throw new BadRequestException(
            "Poids par sac requis (paramètre du type ou weightPerBagKg)"
          );
        }
        deltaKg = new Prisma.Decimal(dto.quantityInput).times(wp);
      } else if (qUnit === FeedTypeUnit.tonne) {
        deltaKg = new Prisma.Decimal(dto.quantityInput).times(1000);
      } else {
        deltaKg = new Prisma.Decimal(dto.quantityInput);
      }

      const newStock = feedType.currentStockKg.plus(deltaKg);
      const wpNum = wp?.toNumber() ?? null;
      const newBags =
        wpNum != null && wpNum > 0
          ? new Prisma.Decimal(newStock.toNumber() / wpNum)
          : null;

      let linkedExpenseId: string | null = null;
      if (dto.unitPrice != null && dto.unitPrice >= 0) {
        const fin = await this.prisma.farmFinanceSettings.findUnique({
          where: { farmId }
        });
        await ensureFarmFinanceBootstrap(this.prisma, farmId);
        const catId = await this.financeFeedCategoryId(farmId);
        const basis = dto.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
        const amount =
          basis === "sac" && qUnit === FeedTypeUnit.sac
            ? dto.quantityInput * dto.unitPrice
            : deltaKg.toNumber() * dto.unitPrice;
        if (amount > 0 && catId) {
          const expense = await this.finance.createExpense(user, farmId, {
            amount,
            currency: fin?.currencyCode,
            label: `Aliment : ${feedType.name}`,
            note: dto.notes?.slice(0, 500),
            occurredAt: occurredAt.toISOString(),
            financeCategoryId: catId,
            linkedEntityType: "feed_type",
            linkedEntityId: feedType.id
          });
          linkedExpenseId = expense.id;
        }
      }

      const movement = await this.prisma.$transaction(async (tx) => {
        const m = await tx.feedStockMovement.create({
          data: {
            farmId,
            feedTypeId: feedType.id,
            kind: FeedMovementKind.in,
            quantityKg: deltaKg,
            stockAfterKg: newStock,
            supplier: dto.supplier?.trim() || null,
            unitPrice:
              dto.unitPrice != null
                ? new Prisma.Decimal(dto.unitPrice)
                : null,
            notes: dto.notes?.trim() || null,
            occurredAt,
            linkedExpenseId,
            createdByUserId: user.id
          }
        });
        await tx.feedType.update({
          where: { id: feedType.id },
          data: {
            currentStockKg: newStock,
            bagCountCurrent: newBags,
            ...(dto.weightPerBagKg != null
              ? { weightPerBagKg: new Prisma.Decimal(dto.weightPerBagKg) }
              : {}),
            ...(wp && !feedType.weightPerBagKg
              ? { weightPerBagKg: wp }
              : {})
          }
        });
        return m;
      });

      void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
      return movement;
    }

    if (dto.kind === FeedMovementKind.stock_check) {
      if (dto.bagsCounted == null) {
        throw new BadRequestException(
          "bagsCounted requis pour un contrôle de stock"
        );
      }
      feedType = await this.prisma.feedType.findUniqueOrThrow({
        where: { id: feedType.id }
      });
      const wp = feedType.weightPerBagKg;
      if (!wp) {
        throw new BadRequestException(
          "Définir weightPerBagKg sur le type avant un contrôle"
        );
      }
      const prevBags =
        feedType.bagCountCurrent ??
        feedType.currentStockKg.div(wp);
      const counted = new Prisma.Decimal(dto.bagsCounted);
      const consumed = prevBags.minus(counted);
      const consumedKg = consumed.times(wp);
      let daysSince = 1;
      if (feedType.lastCheckDate) {
        daysSince = daysBetweenUtc(feedType.lastCheckDate, occurredAt);
      }
      const daily =
        consumedKg.toNumber() > 0
          ? new Prisma.Decimal(consumedKg.toNumber()).div(daysSince)
          : new Prisma.Decimal(0);
      const newStock = counted.times(wp);

      const movement = await this.prisma.$transaction(async (tx) => {
        const m = await tx.feedStockMovement.create({
          data: {
            farmId,
            feedTypeId: feedType.id,
            kind: FeedMovementKind.stock_check,
            bagsCounted: counted,
            bagsConsumed: consumed,
            daysSinceLastCheck: daysSince,
            dailyConsumptionKg: daily,
            stockAfterKg: newStock,
            notes: dto.notes?.trim() || null,
            occurredAt,
            createdByUserId: user.id
          }
        });
        await tx.feedType.update({
          where: { id: feedType.id },
          data: {
            currentStockKg: newStock,
            bagCountCurrent: counted,
            lastCheckDate: occurredAt
          }
        });
        return m;
      });

      void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
      return movement;
    }

    throw new BadRequestException("kind inconnu");
  }
}
