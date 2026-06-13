import type { User } from "@prisma/client";
import type { ProfitabilityService } from "../profitability/profitability.service";
import type { PredictionsService } from "../predictions/predictions.service";
import type {
  ReportPredictionsSection,
  ReportProfitabilitySection
} from "./templates/farm-report.types";

export async function buildReportEnrichmentData(
  user: User,
  farmId: string,
  start: Date,
  end: Date,
  profitability: ProfitabilityService,
  predictions: PredictionsService
): Promise<{
  profitability: ReportProfitabilitySection;
  predictions: ReportPredictionsSection;
}> {
  const [prof, predResult, batches] = await Promise.all([
    profitability
      .getFarmProfitability(user, farmId, "custom", {
        start: start.toISOString(),
        end: end.toISOString()
      })
      .catch(() => null),
    predictions.getPredictions(user, farmId).catch(() => null),
    profitability.getAllBatches(user, farmId).catch(() => [])
  ]);

  const profitabilitySection: ReportProfitabilitySection = prof
    ? {
        available: prof.dataQuality !== "insufficient",
        dataQuality: prof.dataQuality,
        currency: prof.currency,
        marketPricePerKg: prof.marketPricePerKg,
        realized: {
          grossMargin: prof.realized.grossMargin,
          grossMarginPct: prof.realized.grossMarginPct,
          netMargin: prof.realized.netMargin,
          netMarginPct: prof.realized.netMarginPct,
          costPerKg: prof.realized.costPerKg,
          roi: prof.realized.roi,
          breakevenPricePerKg: prof.realized.breakevenPricePerKg,
          revenues: prof.realized.revenues,
          costsTotal: prof.realized.costsTotal
        },
        trendNetMarginPctDelta: prof.trendVsPreviousPeriod.netMarginPctDelta,
        trendGrossMarginPctDelta: prof.trendVsPreviousPeriod.grossMarginPctDelta,
        costBreakdown: prof.costBreakdown.map((c) => ({
          label: c.label,
          amount: c.amount,
          pct: c.pct
        })),
        monthlySeries: prof.monthlySeries.map((m) => ({
          month: m.month,
          revenues: m.revenuesRealized,
          costs: m.costsTotal,
          netMargin: m.netMargin
        })),
        topBatches: [...batches]
          .sort(
            (a, b) =>
              (b.realized.netMarginPct ?? -999) - (a.realized.netMarginPct ?? -999)
          )
          .slice(0, 3)
          .map((b) => ({
            name: b.batchName,
            netMarginPct: b.realized.netMarginPct,
            icActual: b.realized.icActual,
            gmqActual: b.realized.gmqActual
          }))
      }
    : {
        available: false,
        dataQuality: "insufficient",
        currency: "XOF",
        marketPricePerKg: null,
        realized: {
          grossMargin: null,
          grossMarginPct: null,
          netMargin: null,
          netMarginPct: null,
          costPerKg: null,
          roi: null,
          breakevenPricePerKg: null,
          revenues: null,
          costsTotal: null
        },
        trendNetMarginPctDelta: null,
        trendGrossMarginPctDelta: null,
        costBreakdown: [],
        monthlySeries: [],
        topBatches: []
      };

  const payload = predResult?.predictions ?? null;
  const predictionsSection: ReportPredictionsSection = {
    available: Boolean(payload && Object.keys(payload).length > 0),
    generatedAt: predResult?.generated_at ?? null,
    insufficientData: predResult?.insufficient_data != null,
    insufficientMessage: predResult?.insufficient_data?.message ?? null,
    financeForecast: payload
      ? {
          horizon30: mapHorizon(payload.finance_predictions, "30j"),
          horizon60: mapHorizon(payload.finance_predictions, "60j"),
          horizon90: mapHorizon(payload.finance_predictions, "90j"),
          cashFlowAlert: {
            hasAlert: payload.finance_predictions.cash_flow_alert.has_alert,
            message: payload.finance_predictions.cash_flow_alert.message
          }
        }
      : {
          horizon30: null,
          horizon60: null,
          horizon90: null,
          cashFlowAlert: { hasAlert: false, message: null }
        },
    saleTiming: payload
      ? {
          priceTrend: payload.sale_timing.price_trend,
          explanation: payload.sale_timing.price_trend_explanation,
          optimalWindow: `${payload.sale_timing.optimal_window.start_date} → ${payload.sale_timing.optimal_window.end_date}`,
          expectedPricePerKg: payload.sale_timing.optimal_window.expected_price_per_kg
        }
      : null,
    alerts: (payload?.alerts ?? []).slice(0, 5).map((a) => ({
      priority: a.priority,
      message: a.message,
      action: a.action_recommended
    })),
    herdEvolution: payload
      ? {
          current: payload.cheptel_predictions.herd_evolution.current_count,
          projected30: payload.cheptel_predictions.herd_evolution.projected_30j,
          projected60: payload.cheptel_predictions.herd_evolution.projected_60j,
          projected90: payload.cheptel_predictions.herd_evolution.projected_90j,
          growthRate: payload.cheptel_predictions.herd_evolution.growth_rate
        }
      : null,
    animalsReady30: payload?.cheptel_predictions.animals_ready_to_sell["30j"]?.count ?? null,
    upcomingBirths: (payload?.gestation_predictions.upcoming_births ?? [])
      .slice(0, 3)
      .map((b) => ({
        label: b.sow_number,
        date: b.expected_birth_date,
        piglets: b.expected_piglets_count
      }))
  };

  return { profitability: profitabilitySection, predictions: predictionsSection };
}

function mapHorizon(
  fin: {
    revenue_estimates: Record<string, { amount: number }>;
    expense_projections: Record<string, { total: number }>;
    profitability_forecast: Record<string, { margin: number; margin_pct: number }>;
  },
  key: "30j" | "60j" | "90j"
) {
  const rev = fin.revenue_estimates[key];
  const exp = fin.expense_projections[key];
  const margin = fin.profitability_forecast[key];
  if (!rev && !exp && !margin) return null;
  return {
    revenue: rev?.amount ?? 0,
    expenses: exp?.total ?? 0,
    margin: margin?.margin ?? 0,
    marginPct: margin?.margin_pct ?? 0
  };
}
