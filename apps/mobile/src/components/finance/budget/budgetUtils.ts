import { formatFarmMoney } from "../../../lib/formatMoney";
import { mobileColors } from "../../../theme/mobileTheme";

export const formatBudgetMoney = formatFarmMoney;

export function budgetMonthLabel(
  year: number,
  month: number,
  locale: string
): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function budgetShortMonth(
  year: number,
  month: number,
  locale: string
): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString(locale, { month: "short" });
}

export type BudgetStatusTone = "ok" | "warning" | "exceeded";

export function progressColorForStatus(
  status: BudgetStatusTone
): string {
  if (status === "exceeded") return mobileColors.error;
  if (status === "warning") return mobileColors.warning;
  return mobileColors.success;
}

export function globalStatusKey(
  status: "on_track" | "warning" | "exceeded"
): "onTrack" | "warning" | "exceeded" {
  if (status === "on_track") return "onTrack";
  if (status === "warning") return "warning";
  return "exceeded";
}

export function lineStatusEmoji(status: BudgetStatusTone): string {
  if (status === "exceeded") return "🔴";
  if (status === "warning") return "⚠️";
  return "✅";
}
