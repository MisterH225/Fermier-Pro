import { SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import { evaluateFinanceRules } from "./finance.rules";

function prismaMock(overrides: {
  lastExpenseAt?: Date | null;
  missingFeedCostCount?: number;
}) {
  const lastExpenseAt = overrides.lastExpenseAt;
  return {
    farmFinanceSettings: {
      findUnique: jest.fn().mockResolvedValue({
        farmId: "farm1",
        currencyCode: "XOF",
        lowBalanceThreshold: null
      })
    },
    financeCategory: {
      findMany: jest.fn().mockResolvedValue([])
    },
    farmExpense: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      findFirst: jest.fn().mockResolvedValue(
        lastExpenseAt ? { occurredAt: lastExpenseAt } : null
      )
    },
    farmRevenue: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } })
    },
    feedStockMovement: {
      count: jest.fn().mockResolvedValue(overrides.missingFeedCostCount ?? 0)
    }
  };
}

jest.mock("../../finance/finance-bootstrap", () => ({
  ensureFarmFinanceBootstrap: jest.fn().mockResolvedValue(undefined)
}));

describe("evaluateFinanceRules — expense inactive", () => {
  const farmId = "farm1";
  const th = {
    stockCriticalDays: 15,
    stockWarningDays: 30,
    mortalityRateThresholdPct: 5,
    lowBalanceThreshold: null
  };

  it("émet un rappel si dernière dépense ≥ 3 jours", async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const prisma = prismaMock({ lastExpenseAt: fourDaysAgo });
    const out = await evaluateFinanceRules(prisma as never, farmId, th);
    const inactive = out.filter((a) =>
      a.ruleKey.startsWith("finance-expense-inactive:")
    );
    expect(inactive).toHaveLength(1);
    expect(inactive[0].module).toBe(SmartAlertModule.finance);
    expect(inactive[0].priority).toBe(SmartAlertPriority.info);
    expect(inactive[0].action?.route).toBe("FarmFinance");
    expect(inactive[0].i18n?.titleKey).toBe(
      "smartAlerts.finance.expenseInactive.title"
    );
  });

  it("n’émet pas de rappel si dépense récente (< 3 jours)", async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const prisma = prismaMock({ lastExpenseAt: yesterday });
    const out = await evaluateFinanceRules(prisma as never, farmId, th);
    expect(
      out.some((a) => a.ruleKey.startsWith("finance-expense-inactive:"))
    ).toBe(false);
  });

  it("n’émet pas de rappel si aucune dépense historique", async () => {
    const prisma = prismaMock({ lastExpenseAt: null });
    const out = await evaluateFinanceRules(prisma as never, farmId, th);
    expect(
      out.some((a) => a.ruleKey.startsWith("finance-expense-inactive:"))
    ).toBe(false);
  });
});
