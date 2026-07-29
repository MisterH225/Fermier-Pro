import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  type ListingMarketCategory
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
  buildPeriodTotals,
  decimalToNumber,
  emptyPeriodTotals,
  periodPairsAt,
  type BuyerDashboardPeriodKey,
  type PeriodTotals
} from "./buyer-dashboard.aggregations";

export type BuyerDashboardPurchasesDto = {
  currency: string;
  month: PeriodTotals;
  quarter: PeriodTotals;
  year: PeriodTotals;
};

export type BuyerPurchaseRow = {
  amount: number;
  at: Date;
  currency: string;
  /** Clé catégorie : ListingMarketCategory | `shop` | `shop:{slug}` | `other`. */
  categoryKey: string;
};

export type BuyerSpendCategorySlice = {
  key: string;
  amount: number;
  count: number;
};

export type BuyerMonthlySpendPoint = {
  month: string;
  total: number;
};

function sumInWindow(
  rows: Array<{ amount: number; at: Date }>,
  start: Date,
  end: Date
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    if (row.at >= start && row.at < end) {
      total += row.amount;
      count += 1;
    }
  }
  return { total, count };
}

function categoryFromListing(
  category: ListingMarketCategory | null | undefined
): string {
  return category ?? "other";
}

function categoryFromShopProduct(
  category: { slug: string | null; name: string | null } | null | undefined
): string {
  const slug = category?.slug?.trim();
  if (slug) return `shop:${slug}`;
  const name = category?.name?.trim();
  if (name) return `shop:${name.toLowerCase().replace(/\s+/g, "_")}`;
  return "shop";
}

/**
 * Lignes d'achats aboutis (escrow clos + boutique completed).
 * Fenêtre : depuis `from` (inclus) jusqu'à `now` (exclu).
 */
export async function loadBuyerPurchaseRows(
  prisma: PrismaService,
  buyerUserId: string,
  from: Date,
  now = new Date()
): Promise<BuyerPurchaseRow[]> {
  const [escrowClosed, shopCompleted] = await Promise.all([
    prisma.marketplaceTransaction.findMany({
      where: {
        buyerUserId,
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        closedAt: { gte: from, lt: now }
      },
      select: {
        finalAmount: true,
        blockedAmount: true,
        closedAt: true,
        currency: true,
        listing: { select: { category: true } }
      }
    }),
    prisma.merchantOrder.findMany({
      where: {
        buyerUserId,
        status: MerchantOrderStatus.completed,
        completedAt: { gte: from, lt: now }
      },
      select: {
        totalAmount: true,
        completedAt: true,
        product: {
          select: {
            currency: true,
            category: { select: { slug: true, name: true } }
          }
        }
      }
    })
  ]);

  const rows: BuyerPurchaseRow[] = [];
  for (const tx of escrowClosed) {
    if (!tx.closedAt) continue;
    rows.push({
      amount: decimalToNumber(tx.finalAmount ?? tx.blockedAmount),
      at: tx.closedAt,
      currency: tx.currency || "XOF",
      categoryKey: categoryFromListing(tx.listing?.category)
    });
  }
  for (const order of shopCompleted) {
    if (!order.completedAt) continue;
    rows.push({
      amount: decimalToNumber(order.totalAmount),
      at: order.completedAt,
      currency: order.product?.currency || "XOF",
      categoryKey: categoryFromShopProduct(order.product?.category)
    });
  }
  return rows;
}

export function purchasesDtoFromRows(
  rows: BuyerPurchaseRow[],
  now = new Date()
): BuyerDashboardPurchasesDto {
  const pairs = periodPairsAt(now);
  const currency = rows.find((r) => r.currency)?.currency ?? "XOF";
  const purchases: BuyerDashboardPurchasesDto = {
    currency,
    month: emptyPeriodTotals(),
    quarter: emptyPeriodTotals(),
    year: emptyPeriodTotals()
  };
  for (const key of Object.keys(pairs) as BuyerDashboardPeriodKey[]) {
    const pair = pairs[key];
    const cur = sumInWindow(rows, pair.current.start, pair.current.end);
    const prev = sumInWindow(rows, pair.previous.start, pair.previous.end);
    purchases[key] = buildPeriodTotals(
      cur.total,
      prev.total,
      cur.count,
      prev.count
    );
  }
  return purchases;
}

export function categoryBreakdownForWindow(
  rows: BuyerPurchaseRow[],
  start: Date,
  end: Date
): BuyerSpendCategorySlice[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const row of rows) {
    if (row.at < start || row.at >= end) continue;
    const cur = map.get(row.categoryKey) ?? { amount: 0, count: 0 };
    cur.amount += row.amount;
    cur.count += 1;
    map.set(row.categoryKey, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);
}

/** 12 mois calendaires glissants se terminant au mois de `now` (inclus). */
export function monthlyEvolutionLast12(
  rows: BuyerPurchaseRow[],
  now = new Date()
): BuyerMonthlySpendPoint[] {
  const points: BuyerMonthlySpendPoint[] = [];
  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(y, m - i, 1);
    const end = new Date(y, m - i + 1, 1);
    const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const { total } = sumInWindow(rows, start, end);
    points.push({ month, total });
  }
  return points;
}

export function periodWindowOf(
  period: BuyerDashboardPeriodKey,
  now = new Date()
): { start: Date; end: Date } {
  return periodPairsAt(now)[period].current;
}

export type { PeriodTotals, BuyerDashboardPeriodKey };
