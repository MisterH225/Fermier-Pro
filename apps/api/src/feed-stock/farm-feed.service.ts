import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  lineAmountFromUnitPrice,
  quantityInputToKg
} from "../feed-finance-link/feed-stock-quantity.helper";
import { movementHasCost } from "../feed-finance-link/feed-movement-cost.helper";
import { PumpCalculator } from "../feed-finance-link/pump-calculator";
import { ReconciliationEngine } from "../feed-finance-link/reconciliation-engine";
import { recalculateFeedTypeStock } from "../feed-finance-link/feed-stock-recalculate.helper";
import { serializeFeedMovement } from "./feed-movement-serialize.helper";
import { UpdateFeedMovementDto } from "./dto/update-feed-movement.dto";
import type { ReconciliationOfferDto } from "../feed-finance-link/reconciliation.types";
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
import { feedTypeColorAtIndex } from "./feed-type-colors";

const MS_PER_DAY = 86_400_000;

function daysBetweenUtc(a: Date, b: Date): number {
  const d = Math.round(
    (b.getTime() - a.getTime()) / MS_PER_DAY
  );
  return Math.max(1, d);
}

/** Fin de semaine (dimanche 23:59:59.999 UTC) pour la date donnée. */
function endOfUtcWeek(date: Date): Date {
  const utcDay = date.getUTCDay();
  const daysUntilSunday = utcDay === 0 ? 0 : 7 - utcDay;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + daysUntilSunday,
      23,
      59,
      59,
      999
    )
  );
}

function weekEndsSliding(weekCount: number): { key: string; end: Date }[] {
  const currentWeekEnd = endOfUtcWeek(new Date());
  const out: { key: string; end: Date }[] = [];
  for (let back = weekCount - 1; back >= 0; back -= 1) {
    const end = new Date(currentWeekEnd.getTime() - back * 7 * MS_PER_DAY);
    const key = end.toISOString().slice(0, 10);
    out.push({ key, end });
  }
  return out;
}

/** 3m / 6m / 12m → nombre de semaines affichées sur le graphique. */
function periodToWeekCount(raw?: string): number {
  if (raw === "3m" || raw === "3") return 13;
  if (raw === "12m" || raw === "12") return 52;
  return 26;
}

@Injectable()
export class FarmFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly finance: FinanceService,
    private readonly smartAlerts: SmartAlertsService,
    private readonly pump: PumpCalculator,
    private readonly reconciliation: ReconciliationEngine
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
    const existingCount = await this.prisma.feedType.count({ where: { farmId } });
    return this.prisma.feedType.create({
      data: {
        farmId,
        name: dto.name.trim(),
        unit: dto.unit,
        color: dto.color?.trim() || feedTypeColorAtIndex(existingCount),
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
    const weekCount = periodToWeekCount(periodRaw);
    const weeks = weekEndsSliding(weekCount);
    const lastEnd = weeks[weeks.length - 1]?.end ?? new Date();

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

    const series = types.map((t, index) => {
      const arr = (byType.get(t.id) ?? []).slice();
      const points = weeks.map(({ end }) => {
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
        color: feedTypeColorAtIndex(index),
        points
      };
    });

    return {
      farmId,
      periodWeeks: weekCount,
      weekKeys: weeks.map((w) => w.key),
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
    const rows = await this.prisma.feedStockMovement.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        feedType: { select: { id: true, name: true, unit: true } }
      }
    });
    return rows.map((r) => serializeFeedMovement(r));
  }

  async listIncompleteMovements(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const rows = await this.prisma.feedStockMovement.findMany({
      where: {
        farmId,
        kind: FeedMovementKind.in,
        isCostMissing: true
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        feedType: { select: { id: true, name: true, unit: true } }
      }
    });
    return rows.map((r) => serializeFeedMovement(r));
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
  ): Promise<{
    movement: ReturnType<typeof serializeFeedMovement>;
    reconciliation: ReconciliationOfferDto | null;
  }> {
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
      let totalCost: Prisma.Decimal | null = null;
      if (
        !dto.skipAutoFinanceExpense &&
        dto.unitPrice != null &&
        dto.unitPrice >= 0
      ) {
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
          totalCost = new Prisma.Decimal(amount);
        } else if (amount > 0) {
          totalCost = new Prisma.Decimal(amount);
        }
      } else if (dto.unitPrice != null && dto.unitPrice >= 0) {
        const basis = dto.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
        const amount = lineAmountFromUnitPrice(
          dto.quantityInput,
          qUnit,
          deltaKg,
          dto.unitPrice,
          basis
        );
        if (amount > 0) {
          totalCost = new Prisma.Decimal(amount);
        }
      }

      const missingCost = !linkedExpenseId && totalCost == null;

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
            totalCost,
            notes: dto.notes?.trim() || null,
            occurredAt,
            linkedExpenseId,
            isCostMissing: missingCost,
            createdByUserId: user.id
          },
          include: {
            feedType: { select: { id: true, name: true, unit: true } }
          }
        });
        if (linkedExpenseId) {
          await tx.farmExpense.update({
            where: { id: linkedExpenseId },
            data: { linkedStockMovementIds: [m.id] }
          });
        }
        if (totalCost != null) {
          await this.pump.recalculateForFeedType(tx, farmId, feedType.id);
        }
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

      let reconciliation: ReconciliationOfferDto | null = null;
      if (missingCost) {
        const offer = await this.reconciliation.buildOfferForMovement(
          movement.id
        );
        if (offer.status !== "none") {
          reconciliation = offer;
        } else {
          await this.reconciliation.flagCostMissing(movement.id);
        }
      }

      return {
        movement: serializeFeedMovement(movement),
        reconciliation
      };
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
      const prevCheck = await this.prisma.feedStockMovement.findFirst({
        where: {
          farmId,
          feedTypeId: feedType.id,
          kind: FeedMovementKind.stock_check
        },
        orderBy: { occurredAt: "desc" },
        select: { stockAfterKg: true, occurredAt: true, bagsCounted: true }
      });
      const prevBags =
        prevCheck?.bagsCounted ??
        feedType.bagCountCurrent ??
        feedType.currentStockKg.div(wp);
      const counted = new Prisma.Decimal(dto.bagsCounted);
      const consumed = prevBags.minus(counted);
      const newStock = counted.times(wp);
      const prevStockKg = prevCheck?.stockAfterKg ?? feedType.currentStockKg;
      const consumedKg = prevStockKg.minus(newStock);
      let daysSince = 1;
      if (prevCheck) {
        daysSince = daysBetweenUtc(prevCheck.occurredAt, occurredAt);
      } else if (feedType.lastCheckDate) {
        daysSince = daysBetweenUtc(feedType.lastCheckDate, occurredAt);
      }
      const consumedNum = consumedKg.toNumber();
      const daily =
        consumedNum > 0
          ? new Prisma.Decimal(consumedNum).div(daysSince)
          : new Prisma.Decimal(0);

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
          },
          include: {
            feedType: { select: { id: true, name: true, unit: true } }
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
      return {
        movement: serializeFeedMovement(movement),
        reconciliation: null
      };
    }

    throw new BadRequestException("kind inconnu");
  }

  async updateMovement(
    user: User,
    farmId: string,
    movementId: string,
    dto: UpdateFeedMovementDto
  ): Promise<{
    movement: ReturnType<typeof serializeFeedMovement>;
    reconciliation: ReconciliationOfferDto | null;
  }> {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    const existing = await this.prisma.feedStockMovement.findFirst({
      where: { id: movementId, farmId, kind: FeedMovementKind.in },
      include: { feedType: true }
    });
    if (!existing) {
      throw new NotFoundException("Entrée de stock introuvable");
    }

    const feedTypeId = dto.feedTypeId ?? existing.feedTypeId;
    const feedType = await this.prisma.feedType.findFirst({
      where: { id: feedTypeId, farmId }
    });
    if (!feedType) {
      throw new NotFoundException("Type d'aliment introuvable");
    }

    const qUnit = dto.quantityUnit ?? feedType.unit;
    const qtyInput =
      dto.quantityInput ??
      (existing.quantityKg
        ? qUnit === FeedTypeUnit.sac && feedType.weightPerBagKg
          ? existing.quantityKg.div(feedType.weightPerBagKg).toNumber()
          : existing.quantityKg.toNumber()
        : 0);
    const wp =
      dto.weightPerBagKg != null
        ? new Prisma.Decimal(dto.weightPerBagKg)
        : feedType.weightPerBagKg;
    const deltaKg = quantityInputToKg(qtyInput, qUnit, wp);
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt)
      : existing.occurredAt;

    let totalCost =
      dto.totalCost != null
        ? new Prisma.Decimal(dto.totalCost)
        : existing.totalCost;
    let unitPrice =
      dto.unitPrice != null
        ? new Prisma.Decimal(dto.unitPrice)
        : existing.unitPrice;

    if (dto.totalCost == null && dto.unitPrice != null) {
      const basis = dto.priceBasis ?? (qUnit === FeedTypeUnit.sac ? "sac" : "kg");
      const amount = lineAmountFromUnitPrice(
        qtyInput,
        qUnit,
        deltaKg,
        dto.unitPrice,
        basis
      );
      totalCost = new Prisma.Decimal(amount);
    } else if (dto.totalCost != null && dto.unitPrice == null) {
      const perKg = deltaKg.gt(0)
        ? dto.totalCost / deltaKg.toNumber()
        : null;
      unitPrice = perKg != null ? new Prisma.Decimal(perKg) : null;
    }

    const hadCost = movementHasCost(existing);
    const hasCost =
      totalCost != null ||
      (unitPrice != null && unitPrice.toNumber() > 0) ||
      Boolean(existing.linkedExpenseId);

    const movement = await this.prisma.$transaction(async (tx) => {
      const m = await tx.feedStockMovement.update({
        where: { id: movementId },
        data: {
          feedTypeId,
          quantityKg: deltaKg,
          supplier:
            dto.supplier !== undefined
              ? dto.supplier?.trim() || null
              : existing.supplier,
          unitPrice,
          totalCost,
          notes:
            dto.notes !== undefined
              ? dto.notes?.trim() || null
              : existing.notes,
          occurredAt,
          isCostMissing: !hasCost
        },
        include: {
          feedType: { select: { id: true, name: true, unit: true } }
        }
      });

      if (
        existing.linkedExpenseId &&
        dto.totalCost != null &&
        totalCost != null
      ) {
        await tx.farmExpense.update({
          where: { id: existing.linkedExpenseId },
          data: { amount: totalCost }
        });
      }

      await recalculateFeedTypeStock(tx, farmId, feedTypeId);
      if (feedTypeId !== existing.feedTypeId) {
        await recalculateFeedTypeStock(tx, farmId, existing.feedTypeId);
      }
      await this.pump.recalculateForFeedType(tx, farmId, feedTypeId);
      return m;
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    let reconciliation: ReconciliationOfferDto | null = null;
    if (!hadCost && hasCost && !existing.linkedExpenseId) {
      // coût ajouté sans liaison — pas de rapprochement nécessaire
    } else if (!hasCost) {
      const offer = await this.reconciliation.buildOfferForMovement(movementId);
      reconciliation = offer.status !== "none" ? offer : null;
      if (!reconciliation) {
        await this.reconciliation.flagCostMissing(movementId);
      }
    }

    return {
      movement: serializeFeedMovement(movement),
      reconciliation
    };
  }

  async deleteMovement(
    user: User,
    farmId: string,
    movementId: string
  ): Promise<{ ok: true }> {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockWrite
    ]);
    const existing = await this.prisma.feedStockMovement.findFirst({
      where: { id: movementId, farmId, kind: FeedMovementKind.in }
    });
    if (!existing) {
      throw new NotFoundException("Entrée de stock introuvable");
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing.linkedExpenseId) {
        const expense = await tx.farmExpense.findUnique({
          where: { id: existing.linkedExpenseId }
        });
        if (expense) {
          const ids = expense.linkedStockMovementIds.filter(
            (id) => id !== movementId
          );
          await tx.farmExpense.update({
            where: { id: expense.id },
            data: { linkedStockMovementIds: ids }
          });
        }
      }
      await tx.feedStockMovement.delete({ where: { id: movementId } });
      await recalculateFeedTypeStock(tx, farmId, existing.feedTypeId);
      await this.pump.recalculateForFeedType(tx, farmId, existing.feedTypeId);
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
    return { ok: true };
  }
}
