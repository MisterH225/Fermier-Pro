import type { PrismaClient } from "@prisma/client";
import { PigPriceIndexCategory, SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import {
  categoryLabelFr,
  MIN_TRANSACTIONS_FOR_POINT,
  startOfUtcDay
} from "../../market/pig-price-index.types";
import type { ComputedSmartAlert } from "../smart-alerts.types";

/** Seuil spec SmartAlert : variation absolue > 5 % sur 24 h. */
export const MARKET_PRICE_VARIATION_THRESHOLD_PCT = 5;

const MARKET_CATEGORIES: PigPriceIndexCategory[] = [
  PigPriceIndexCategory.porcelet,
  PigPriceIndexCategory.croissance,
  PigPriceIndexCategory.charcutier,
  PigPriceIndexCategory.reproducteur
];

export async function evaluateMarketRules(
  prisma: PrismaClient
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  const today = startOfUtcDay(new Date());
  const dayKey = today.toISOString().slice(0, 10);

  const rows = await prisma.pigPriceIndexDaily.findMany({
    where: {
      date: today,
      category: { in: MARKET_CATEGORIES },
      transactionCount: { gte: MIN_TRANSACTIONS_FOR_POINT }
    }
  });

  for (const row of rows) {
    const variation = row.variationPct?.toNumber() ?? null;
    if (
      variation == null ||
      Math.abs(variation) <= MARKET_PRICE_VARIATION_THRESHOLD_PCT
    ) {
      continue;
    }

    const label = categoryLabelFr(row.category);
    const isUp = variation > 0;
    const absPct = Math.abs(variation).toFixed(1);
    const price =
      row.weightedAvgPrice?.toNumber() ?? row.avgPricePerKg.toNumber();
    const priceFormatted = Math.round(price).toLocaleString("fr-FR");

    out.push({
      ruleKey: `market-price-variation:${row.category}:${dayKey}`,
      module: SmartAlertModule.market,
      priority:
        Math.abs(variation) >= 10
          ? SmartAlertPriority.warning
          : SmartAlertPriority.info,
      title: isUp ? `Prix ${label} en hausse` : `Prix ${label} en baisse`,
      message: `Le cours ${label} a ${isUp ? "augmenté" : "baissé"} de ${absPct} % sur 24 h (${priceFormatted} FCFA/kg, indice plateforme).`,
      i18n: {
        titleKey: isUp
          ? "smartAlerts.market.priceUp.title"
          : "smartAlerts.market.priceDown.title",
        messageKey: isUp
          ? "smartAlerts.market.priceUp.message"
          : "smartAlerts.market.priceDown.message",
        params: {
          categoryKey: row.category,
          pct: absPct,
          price: priceFormatted
        }
      },
      action: {
        label: "Voir l'indice",
        route: "BuyerDashboard",
        params: {}
      }
    });
  }

  return out;
}
