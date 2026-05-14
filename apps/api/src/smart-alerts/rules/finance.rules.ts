import type { PrismaClient } from "@prisma/client";
import { Prisma, SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import { ensureFarmFinanceBootstrap } from "../../finance/finance-bootstrap";
import type { ComputedSmartAlert, FarmAlertThresholds } from "../smart-alerts.types";

export async function evaluateFinanceRules(
  prisma: PrismaClient,
  farmId: string,
  th: FarmAlertThresholds
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  await ensureFarmFinanceBootstrap(prisma, farmId);
  const settings = await prisma.farmFinanceSettings.findUnique({
    where: { farmId }
  });
  if (!settings) {
    return out;
  }
  const currency = settings.currencyCode;
  const lowBal =
    th.lowBalanceThreshold ??
    settings.lowBalanceThreshold?.toNumber() ??
    null;

  const now = new Date();
  const startCur = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const endCur = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const startPrev = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );

  const cats = await prisma.financeCategory.findMany({
    where: { farmId, type: "expense" },
    select: { id: true, name: true, key: true }
  });

  for (const c of cats) {
    const [aggCur, aggPrev] = await Promise.all([
      prisma.farmExpense.aggregate({
        where: {
          farmId,
          financeCategoryId: c.id,
          occurredAt: { gte: startCur, lt: endCur }
        },
        _sum: { amount: true }
      }),
      prisma.farmExpense.aggregate({
        where: {
          farmId,
          financeCategoryId: c.id,
          occurredAt: { gte: startPrev, lt: startCur }
        },
        _sum: { amount: true }
      })
    ]);
    const spent = aggCur._sum.amount ?? new Prisma.Decimal(0);
    const prev = aggPrev._sum.amount ?? new Prisma.Decimal(0);
    if (prev.gt(0)) {
      const ratio = spent.div(prev).toNumber();
      if (ratio >= 1.3) {
        const pct = Math.round((ratio - 1) * 100);
        out.push({
          ruleKey: `finance-cat-up:${c.id}:${startCur.toISOString().slice(0, 7)}`,
          module: SmartAlertModule.finance,
          priority: SmartAlertPriority.warning,
          title: "Dépenses en hausse",
          message: `Dépenses « ${c.name} » en hausse de ${pct} % vs le mois précédent.`,
          action: {
            label: "Finance",
            route: "FarmFinance",
            params: { farmId }
          }
        });
      }
    }
  }

  const [expCur, revCur] = await Promise.all([
    prisma.farmExpense.aggregate({
      where: { farmId, occurredAt: { gte: startCur, lt: endCur } },
      _sum: { amount: true }
    }),
    prisma.farmRevenue.aggregate({
      where: { farmId, occurredAt: { gte: startCur, lt: endCur } },
      _sum: { amount: true }
    })
  ]);
  const expPrev = await prisma.farmExpense.aggregate({
    where: { farmId, occurredAt: { gte: startPrev, lt: startCur } },
    _sum: { amount: true }
  });
  const e0 = expCur._sum.amount ?? new Prisma.Decimal(0);
  const e1 = expPrev._sum.amount ?? new Prisma.Decimal(0);
  if (e1.gt(0) && e0.gt(e1.times(1.3))) {
    const pct = Math.round(e0.sub(e1).div(e1).toNumber() * 100);
    out.push({
      ruleKey: `finance-expenses-up-month:${startCur.toISOString().slice(0, 7)}`,
      module: SmartAlertModule.finance,
      priority: SmartAlertPriority.warning,
      title: "Dépenses globales",
      message: `Dépenses du mois en hausse de ${pct} % vs le mois dernier.`,
      action: {
        label: "Finance",
        route: "FarmFinance",
        params: { farmId }
      }
    });
  }

  const totalRev = await prisma.farmRevenue.aggregate({
    where: { farmId },
    _sum: { amount: true }
  });
  const totalExp = await prisma.farmExpense.aggregate({
    where: { farmId },
    _sum: { amount: true }
  });
  const balance = (totalRev._sum.amount ?? new Prisma.Decimal(0)).sub(
    totalExp._sum.amount ?? new Prisma.Decimal(0)
  );
  if (lowBal != null && balance.lt(new Prisma.Decimal(lowBal))) {
    out.push({
      ruleKey: "finance-low-balance",
      module: SmartAlertModule.finance,
      priority: SmartAlertPriority.critical,
      title: "Solde bas",
      message: `Solde courant ${balance.toDecimalPlaces(0).toString()} ${currency} — sous le seuil d’alerte (${lowBal}).`,
      action: {
        label: "Finance",
        route: "FarmFinance",
        params: { farmId }
      }
    });
  }

  const months: { start: Date; end: Date }[] = [];
  for (let i = 6; i >= 1; i -= 1) {
    const ref = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    months.push({
      start: new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)),
      end: new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1))
    });
  }
  let sumExp = new Prisma.Decimal(0);
  let sumRev = new Prisma.Decimal(0);
  for (const { start, end } of months) {
    const [e, r] = await Promise.all([
      prisma.farmExpense.aggregate({
        where: { farmId, occurredAt: { gte: start, lt: end } },
        _sum: { amount: true }
      }),
      prisma.farmRevenue.aggregate({
        where: { farmId, occurredAt: { gte: start, lt: end } },
        _sum: { amount: true }
      })
    ]);
    sumExp = sumExp.add(e._sum.amount ?? new Prisma.Decimal(0));
    sumRev = sumRev.add(r._sum.amount ?? new Prisma.Decimal(0));
  }
  const avgExp = sumExp.div(6);
  const avgRev = sumRev.div(6);
  if (avgRev.sub(avgExp).lt(new Prisma.Decimal(0))) {
    out.push({
      ruleKey: "finance-margin-negative",
      module: SmartAlertModule.finance,
      priority: SmartAlertPriority.critical,
      title: "Marge négative",
      message:
        "Marge moyenne sur 6 mois négative — les coûts dépassent les revenus.",
      action: {
        label: "Finance",
        route: "FarmFinance",
        params: { farmId }
      }
    });
  }

  return out;
}
