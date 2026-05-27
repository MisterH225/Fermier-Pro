import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SmartChart, type SmartChartLine } from "../charts";
import type { ProfitabilityHistoryPointDto } from "../../lib/api";

type Props = {
  history: ProfitabilityHistoryPointDto[];
  currencySymbol: string;
};

export function EvolutionChart({ history, currencySymbol }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const lines: SmartChartLine[] = useMemo(
    () => [
      {
        key: "cost",
        label: t("profitability.chartCost"),
        color: "#E24B4A",
        data: history.map((h) => ({
          month: h.monthKey,
          value: h.costPerKgSold ?? 0
        }))
      },
      {
        key: "price",
        label: t("profitability.chartPrice"),
        color: "#1D9E75",
        data: history.map((h) => ({
          month: h.monthKey,
          value: h.salePricePerKg ?? 0
        }))
      },
      {
        key: "breakEven",
        label: t("profitability.chartBreakEven"),
        color: "#BA7517",
        data: history.map((h) => ({
          month: h.monthKey,
          value: h.breakEvenPricePerKg ?? 0
        }))
      }
    ],
    [history, t]
  );

  if (history.length < 2) {
    return null;
  }

  return (
    <SmartChart
      lines={lines}
      period="6M"
      formatValue={(n) => `${Math.round(n)} ${currencySymbol}`}
      monthLabel={(iso) => {
        const [y, m] = iso.split("-").map(Number);
        if (!y || !m) return iso;
        return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
          month: "short"
        });
      }}
      unit={currencySymbol}
    />
  );
}
