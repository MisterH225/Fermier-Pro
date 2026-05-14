import type { PrismaClient } from "@prisma/client";
import { SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import {
  buildFeedStockStatsForFarm,
  feedStockConsumptionSpikeMessages
} from "../../feed-stock/feed-stock-stats.helper";
import type { ComputedSmartAlert, FarmAlertThresholds } from "../smart-alerts.types";

const MS_DAY = 86_400_000;

export async function evaluateStockRules(
  prisma: PrismaClient,
  farmId: string,
  th: FarmAlertThresholds
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  const stats = await buildFeedStockStatsForFarm(prisma, farmId, {
    criticalDays: th.stockCriticalDays,
    warningDays: th.stockWarningDays
  });

  for (const s of stats) {
    if (s.daysRemaining != null && s.daysRemaining < th.stockCriticalDays) {
      const daily = s.avgDailyConsumptionKg
        ? Number.parseFloat(s.avgDailyConsumptionKg)
        : 0;
      const suggestKg = Math.max(0, Math.ceil(daily * th.stockWarningDays));
      out.push({
        ruleKey: `stock-depletion-critical:${s.feedTypeId}`,
        module: SmartAlertModule.stock,
        priority: SmartAlertPriority.critical,
        title: "Stock aliment critique",
        message: `Stock « ${s.name} » épuisé dans environ ${s.daysRemaining} j — commander ~${suggestKg} kg.`,
        action: {
          label: "Voir stock aliment",
          route: "FarmFeedStock",
          params: { farmId }
        }
      });
    } else if (
      s.daysRemaining != null &&
      s.daysRemaining <= th.stockWarningDays
    ) {
      out.push({
        ruleKey: `stock-depletion-warning:${s.feedTypeId}`,
        module: SmartAlertModule.stock,
        priority: SmartAlertPriority.warning,
        title: "Stock aliment en baisse",
        message: `Stock « ${s.name} » : environ ${s.daysRemaining} j restants — prévoir commande.`,
        action: {
          label: "Voir stock aliment",
          route: "FarmFeedStock",
          params: { farmId }
        }
      });
    }

    if (s.lastCheckDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(s.lastCheckDate).getTime()) / MS_DAY
      );
      if (daysSince > 7) {
        out.push({
          ruleKey: `stock-check-stale:${s.feedTypeId}`,
          module: SmartAlertModule.stock,
          priority: SmartAlertPriority.info,
          title: "Contrôle stock",
          message: `Dernier contrôle « ${s.name} » il y a ${daysSince} j — faire un point.`,
          action: {
            label: "Saisir inventaire",
            route: "FarmFeedStock",
            params: { farmId }
          }
        });
      }
    } else {
      out.push({
        ruleKey: `stock-never-checked:${s.feedTypeId}`,
        module: SmartAlertModule.stock,
        priority: SmartAlertPriority.info,
        title: "Contrôle stock",
        message: `Aucun contrôle enregistré pour « ${s.name} » — planifier un inventaire.`,
        action: {
          label: "Stock aliment",
          route: "FarmFeedStock",
          params: { farmId }
        }
      });
    }
  }

  const spikes = await feedStockConsumptionSpikeMessages(prisma, farmId);
  for (const sp of spikes) {
    out.push({
      ruleKey: sp.ruleKey,
      module: SmartAlertModule.stock,
      priority: SmartAlertPriority.warning,
      title: "Pic de consommation",
      message: sp.message,
      action: {
        label: "Analyser stock",
        route: "FarmFeedStock",
        params: { farmId }
      }
    });
  }

  return out;
}
