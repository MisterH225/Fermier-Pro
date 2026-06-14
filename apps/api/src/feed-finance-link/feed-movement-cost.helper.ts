import type { FarmExpense, FeedStockMovement } from "@prisma/client";

const MS_DAY = 86_400_000;
const RECON_WINDOW_DAYS = 3;

export function reconciliationDateWindow(center: Date): { gte: Date; lte: Date } {
  const gte = new Date(center.getTime() - RECON_WINDOW_DAYS * MS_DAY);
  const lte = new Date(center.getTime() + RECON_WINDOW_DAYS * MS_DAY);
  return { gte, lte };
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function movementQuantityKg(m: Pick<FeedStockMovement, "quantityKg">): number {
  return m.quantityKg?.toNumber() ?? 0;
}

export function movementHasCost(
  m: Pick<FeedStockMovement, "unitPrice" | "totalCost" | "linkedExpenseId">
): boolean {
  if (m.linkedExpenseId) {
    return true;
  }
  if (m.totalCost != null && m.totalCost.toNumber() > 0) {
    return true;
  }
  if (m.unitPrice != null && m.unitPrice.toNumber() > 0) {
    return true;
  }
  return false;
}

export function resolveMovementTotalCost(
  m: Pick<FeedStockMovement, "totalCost" | "unitPrice" | "quantityKg">,
  linkedExpense?: Pick<FarmExpense, "amount"> | null
): number | null {
  if (m.totalCost != null) {
    return m.totalCost.toNumber();
  }
  if (linkedExpense) {
    return linkedExpense.amount.toNumber();
  }
  const kg = movementQuantityKg(m);
  if (m.unitPrice != null && kg > 0) {
    return m.unitPrice.toNumber() * kg;
  }
  return null;
}

export function unitPricePerKgFromTotal(
  totalCost: number,
  quantityKg: number
): number | null {
  if (quantityKg <= 0 || totalCost <= 0) {
    return null;
  }
  return totalCost / quantityKg;
}

export function daysBetweenDates(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / MS_DAY);
}

export function isDismissedRecently(dismissedAt: Date | null): boolean {
  if (!dismissedAt) {
    return false;
  }
  return Date.now() - dismissedAt.getTime() < 24 * MS_DAY;
}
