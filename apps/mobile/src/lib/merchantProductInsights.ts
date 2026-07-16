/** Agrégats ventes + recommandations de réassort pour le menu Produits commerçant. */

export type SalesOrderLike = {
  status: string;
  totalAmount: number;
  sellerNet?: number;
  createdAt: string;
  paidAt?: string | null;
  completedAt?: string | null;
};

export type SalesMonthPoint = {
  month: string;
  value: number;
};

export type RestockProductLike = {
  id: string;
  name: string;
  stock: number;
  status: string;
};

export type RestockOrderLike = {
  productId: string;
  quantity: number;
  status: string;
  createdAt: string;
};

export type RestockPriority = "critical" | "warning" | "info";

export type RestockReason =
  | "out_of_stock"
  | "low_stock_fast"
  | "low_stock"
  | "cover_soon";

export type RestockRecommendation = {
  productId: string;
  productName: string;
  stock: number;
  unitsSold30d: number;
  daysOfStock: number | null;
  suggestedQty: number;
  priority: RestockPriority;
  reason: RestockReason;
};

/** Statuts comptés comme vente réelle (hors brouillon / refus / annulé). */
export const COUNTED_SALE_STATUSES = new Set([
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "completed"
]);

export function isCountedSaleStatus(status: string): boolean {
  return COUNTED_SALE_STATUSES.has(status);
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Clés mois UTC sur les `count` derniers mois (du plus ancien au courant). */
export function buildLastNMonthKeys(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

function orderEventDate(order: SalesOrderLike): Date {
  const raw = order.paidAt ?? order.completedAt ?? order.createdAt;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(order.createdAt) : d;
}

/**
 * Série mensuelle de revenus vendeur (sellerNet, sinon totalAmount)
 * sur les 12 derniers mois (mois sans vente = 0).
 */
export function buildSalesSeriesFromOrders(
  orders: SalesOrderLike[],
  options?: {
    months?: number;
    now?: Date;
    valueField?: "sellerNet" | "totalAmount";
  }
): SalesMonthPoint[] {
  const months = options?.months ?? 12;
  const now = options?.now ?? new Date();
  const valueField = options?.valueField ?? "sellerNet";
  const keys = buildLastNMonthKeys(months, now);
  const totals = new Map<string, number>(keys.map((k) => [k, 0]));

  for (const order of orders) {
    if (!isCountedSaleStatus(order.status)) continue;
    const key = monthKeyFromDate(orderEventDate(order));
    if (!totals.has(key)) continue;
    const amount =
      valueField === "sellerNet"
        ? (order.sellerNet ?? order.totalAmount)
        : order.totalAmount;
    if (!Number.isFinite(amount)) continue;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  return keys.map((month) => ({
    month,
    value: Math.round(totals.get(month) ?? 0)
  }));
}

function unitsSoldByProduct(
  orders: RestockOrderLike[],
  sinceMs: number
): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (!isCountedSaleStatus(order.status)) continue;
    const t = new Date(order.createdAt).getTime();
    if (!Number.isFinite(t) || t < sinceMs) continue;
    const qty = Number.isFinite(order.quantity) ? order.quantity : 0;
    if (qty <= 0) continue;
    map.set(order.productId, (map.get(order.productId) ?? 0) + qty);
  }
  return map;
}

const PRIORITY_RANK: Record<RestockPriority, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

/**
 * Recommandations de réassort basées sur vélocité 30 j + stock actuel.
 * Heuristique métier (pas d’appel IA externe) pour guider le commerçant.
 */
export function buildRestockRecommendations(
  products: RestockProductLike[],
  orders: RestockOrderLike[],
  options?: {
    now?: Date;
    windowDays?: number;
    lowStockThreshold?: number;
    targetCoverDays?: number;
  }
): RestockRecommendation[] {
  const now = options?.now ?? new Date();
  const windowDays = options?.windowDays ?? 30;
  const lowStockThreshold = options?.lowStockThreshold ?? 5;
  const targetCoverDays = options?.targetCoverDays ?? 21;
  const sinceMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const soldMap = unitsSoldByProduct(orders, sinceMs);
  const out: RestockRecommendation[] = [];

  for (const product of products) {
    if (product.status === "moderated_removed") continue;
    const unitsSold30d = soldMap.get(product.id) ?? 0;
    const dailyVelocity = unitsSold30d / windowDays;
    const daysOfStock =
      dailyVelocity > 0 ? product.stock / dailyVelocity : null;

    let priority: RestockPriority | null = null;
    let reason: RestockReason | null = null;

    if (product.stock <= 0) {
      priority = "critical";
      reason = "out_of_stock";
    } else if (daysOfStock != null && daysOfStock < 3) {
      priority = "critical";
      reason = "low_stock_fast";
    } else if (daysOfStock != null && daysOfStock < 14) {
      priority = "warning";
      reason = "low_stock_fast";
    } else if (product.stock <= lowStockThreshold) {
      priority = "warning";
      reason = "low_stock";
    } else if (daysOfStock != null && daysOfStock < 30 && unitsSold30d >= 3) {
      priority = "info";
      reason = "cover_soon";
    }

    if (!priority || !reason) continue;

    const targetStock = Math.max(
      lowStockThreshold + 1,
      Math.ceil(dailyVelocity * targetCoverDays)
    );
    const suggestedQty = Math.max(1, targetStock - product.stock);

    out.push({
      productId: product.id,
      productName: product.name,
      stock: product.stock,
      unitsSold30d,
      daysOfStock:
        daysOfStock == null ? null : Math.round(daysOfStock * 10) / 10,
      suggestedQty,
      priority,
      reason
    });
  }

  return out.sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    const da = a.daysOfStock ?? Number.POSITIVE_INFINITY;
    const db = b.daysOfStock ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.unitsSold30d - a.unitsSold30d;
  });
}
