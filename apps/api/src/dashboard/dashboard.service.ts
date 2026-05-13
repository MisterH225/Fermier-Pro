import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async financeTimeseries(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.financeRead
    ]);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const settings = await this.prisma.farmFinanceSettings.findUniqueOrThrow({
      where: { farmId }
    });
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let delta = 2; delta >= 0; delta -= 1) {
      const ref = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - delta, 1)
      );
      const start = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)
      );
      const end = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1)
      );
      const label = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
      months.push({ label, start, end });
    }

    const series = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [exp, rev] = await Promise.all([
          this.prisma.farmExpense.aggregate({
            where: { farmId, occurredAt: { gte: start, lt: end } },
            _sum: { amount: true }
          }),
          this.prisma.farmRevenue.aggregate({
            where: { farmId, occurredAt: { gte: start, lt: end } },
            _sum: { amount: true }
          })
        ]);
        return {
          month: label,
          expenses: (exp._sum.amount ?? new Prisma.Decimal(0)).toString(),
          revenues: (rev._sum.amount ?? new Prisma.Decimal(0)).toString(),
          currency: settings.currencyCode
        };
      })
    );

    return { farmId, months: series };
  }

  async criticalGestations(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const now = new Date();
    const limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.animal.findMany({
      where: {
        farmId,
        status: "active",
        expectedFarrowingAt: { gte: now, lte: limit }
      },
      orderBy: { expectedFarrowingAt: "asc" },
      take: 20,
      select: {
        id: true,
        publicId: true,
        tagCode: true,
        expectedFarrowingAt: true
      }
    });

    return {
      farmId,
      items: rows.map((a) => {
        const due = a.expectedFarrowingAt!;
        const ms = due.getTime() - now.getTime();
        const daysRemaining = Math.max(
          0,
          Math.ceil(ms / (24 * 60 * 60 * 1000))
        );
        return {
          animalId: a.id,
          label: a.tagCode?.trim() || a.publicId,
          expectedFarrowingAt: due.toISOString(),
          daysRemaining,
          urgent: daysRemaining <= 3
        };
      })
    };
  }

  async healthSummary(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.healthRead
    ]);

    const tasksRead = await this.farmAccess.hasFarmScope(
      user.id,
      farmId,
      FARM_SCOPE.tasksRead
    );
    const vetRead = await this.farmAccess.hasFarmScope(
      user.id,
      farmId,
      FARM_SCOPE.vetRead
    );
    const exitsRead = await this.farmAccess.hasFarmScope(
      user.id,
      farmId,
      FARM_SCOPE.exitsRead
    );

    const vaccines = tasksRead
      ? await this.prisma.farmTask.findMany({
          where: {
            farmId,
            status: { in: ["todo", "in_progress"] },
            dueAt: { gte: new Date() },
            OR: [
              { category: { contains: "vaccin", mode: "insensitive" } },
              { title: { contains: "vaccin", mode: "insensitive" } }
            ]
          },
          orderBy: { dueAt: "asc" },
          take: 5,
          select: { id: true, title: true, dueAt: true, description: true }
        })
      : [];

    const nextVet = vetRead
      ? await this.prisma.vetConsultation.findFirst({
          where: {
            farmId,
            status: { in: ["open", "in_progress"] }
          },
          orderBy: { openedAt: "asc" },
          select: { id: true, subject: true, openedAt: true, status: true }
        })
      : null;

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const diseaseAgg = await this.prisma.animalHealthEvent.groupBy({
      by: ["title"],
      where: {
        animal: { farmId },
        severity: { in: ["watch", "urgent"] },
        recordedAt: { gte: since30 }
      },
      _count: { _all: true },
      orderBy: { _count: { title: "desc" } },
      take: 5
    });

    const diseaseActiveCount = await this.prisma.animalHealthEvent.count({
      where: {
        animal: { farmId },
        severity: { in: ["watch", "urgent"] },
        recordedAt: { gte: since30 }
      }
    });

    let mortalityRate30d: string | null = null;
    if (exitsRead) {
      const mortalities = await this.prisma.livestockExit.aggregate({
        where: {
          farmId,
          kind: "mortality",
          occurredAt: { gte: since30 }
        },
        _sum: { headcountAffected: true }
      });
      const dead = mortalities._sum.headcountAffected ?? 0;
      const activeCount = await this.prisma.animal.count({
        where: { farmId, status: "active" }
      });
      const denom = Math.max(1, activeCount);
      mortalityRate30d = (dead / denom).toFixed(4);
    }

    return {
      farmId,
      upcomingVaccines: vaccines.map((t) => ({
        taskId: t.id,
        title: t.title,
        dueAt: t.dueAt?.toISOString() ?? null,
        animalHint: t.description?.split("\n")[0]?.slice(0, 160) ?? null
      })),
      nextVetConsultation: nextVet
        ? {
            id: nextVet.id,
            subject: nextVet.subject,
            openedAt: nextVet.openedAt.toISOString(),
            status: nextVet.status
          }
        : null,
      activeDiseaseCases: {
        count: diseaseActiveCount,
        byType: diseaseAgg.map((g) => ({
          title: g.title,
          count: g._count._all
        }))
      },
      mortalityRate30d,
      mortalityWindowDays: 30
    };
  }

  async feedStockSummary(user: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.livestockRead
    ]);
    const lots = await this.prisma.feedStockLot.findMany({
      where: { farmId },
      select: {
        productName: true,
        remainingKg: true,
        quantityKg: true
      }
    });

    const byName = new Map<
      string,
      { remaining: Prisma.Decimal; initial: Prisma.Decimal }
    >();
    for (const l of lots) {
      const cur =
        byName.get(l.productName) ?? {
          remaining: new Prisma.Decimal(0),
          initial: new Prisma.Decimal(0)
        };
      cur.remaining = cur.remaining.plus(l.remainingKg);
      cur.initial = cur.initial.plus(l.quantityKg);
      byName.set(l.productName, cur);
    }

    const items = [...byName.entries()].map(([productName, v]) => {
      const ratio = v.initial.gt(0)
        ? v.remaining.div(v.initial).toNumber()
        : 0;
      const remainingNum = v.remaining.toNumber();
      let level: "critical" | "medium" | "ok";
      if (ratio < 0.15 || remainingNum < 50) {
        level = "critical";
      } else if (ratio < 0.45) {
        level = "medium";
      } else {
        level = "ok";
      }
      return {
        productName,
        remainingKg: v.remaining.toString(),
        initialKg: v.initial.toString(),
        ratio,
        level,
        critical: level === "critical"
      };
    });

    return { farmId, items };
  }
}
