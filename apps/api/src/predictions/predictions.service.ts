import { Injectable, Logger } from "@nestjs/common";
import type { User } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { PredictionDataCollectorService } from "./prediction-data-collector.service";
import { FeedPurchaseForecastService } from "./feed-purchase-forecast.service";
import { PredictiveAgentService } from "./predictive-agent.service";
import {
  PREDICTION_HORIZON_DAYS,
  PREDICTION_MIN_DAYS,
  type FarmPredictionsPayload,
  type FarmPredictionsResult,
  type PredictionMenuKey
} from "./prediction.types";

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);
  private readonly regenerating = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly collector: PredictionDataCollectorService,
    private readonly agent: PredictiveAgentService,
    private readonly feedForecast: FeedPurchaseForecastService
  ) {}

  async getPredictions(
    user: User,
    farmId: string
  ): Promise<FarmPredictionsResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.buildResult(farmId);
  }

  async getMenuPredictions(
    user: User,
    farmId: string,
    menu: PredictionMenuKey
  ): Promise<FarmPredictionsResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const full = await this.buildResult(farmId);
    return this.sliceForMenu(full, menu);
  }

  async generatePredictions(
    user: User,
    farmId: string
  ): Promise<FarmPredictionsResult> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.generateInternal(farmId);
    return this.buildResult(farmId);
  }

  /** Invalidation + régénération asynchrone (événements clés). */
  invalidateAndRegenerateAsync(farmId: string): void {
    if (this.regenerating.has(farmId)) {
      return;
    }
    this.regenerating.add(farmId);
    void this.invalidateCache(farmId)
      .then(() => this.generateInternal(farmId))
      .catch((e) =>
        this.logger.warn(
          `Régénération prévisions ${farmId}: ${(e as Error).message}`
        )
      )
      .finally(() => {
        this.regenerating.delete(farmId);
      });
  }

  async invalidateCache(farmId: string): Promise<void> {
    await this.prisma.farmPrediction.deleteMany({ where: { farmId } });
  }

  async generateInternal(farmId: string): Promise<void> {
    const collected = await this.collector.collect(farmId);

    if (collected.days_of_data < PREDICTION_MIN_DAYS) {
      await this.prisma.farmPrediction.upsert({
        where: { farmId },
        create: {
          farmId,
          predictionsJson: {},
          generatedAt: new Date(),
          dataQualityScore: collected.data_quality_score,
          daysOfData: collected.days_of_data,
          horizonDays: PREDICTION_HORIZON_DAYS
        },
        update: {
          predictionsJson: {},
          generatedAt: new Date(),
          dataQualityScore: collected.data_quality_score,
          daysOfData: collected.days_of_data
        }
      });
      return;
    }

    const geminiPredictions = await this.agent.generatePredictions(collected);
    const stockPredictions =
      await this.feedForecast.computeStockPredictions(farmId);
    const predictions = this.mergeStockPredictions(
      geminiPredictions,
      stockPredictions
    );

    await this.prisma.farmPrediction.upsert({
      where: { farmId },
      create: {
        farmId,
        predictionsJson: (predictions ?? {}) as object,
        generatedAt: new Date(),
        dataQualityScore: collected.data_quality_score,
        daysOfData: collected.days_of_data,
        horizonDays: PREDICTION_HORIZON_DAYS
      },
      update: {
        predictionsJson: (predictions ?? {}) as object,
        generatedAt: new Date(),
        dataQualityScore: collected.data_quality_score,
        daysOfData: collected.days_of_data
      }
    });
  }

  async refreshAllActiveFarms(): Promise<void> {
    const farms = await this.prisma.farm.findMany({
      where: { status: "active" },
      select: { id: true }
    });
    for (const f of farms) {
      try {
        const collected = await this.collector.collect(f.id);
        if (collected.days_of_data >= PREDICTION_MIN_DAYS) {
          await this.generateInternal(f.id);
        }
      } catch (e) {
        this.logger.warn(
          `Cron prévisions ferme ${f.id}: ${(e as Error).message}`
        );
      }
    }
  }

  /**
   * Génère les prévisions si le cache est vide — même clé GEMINI_API_KEY que AiService.
   */
  private async ensureGeneratedIfNeeded(farmId: string): Promise<void> {
    if (!this.agent.isConfigured()) {
      return;
    }
    if (this.regenerating.has(farmId)) {
      return;
    }

    const collected = await this.collector.collect(farmId);
    if (collected.days_of_data < PREDICTION_MIN_DAYS) {
      return;
    }

    const cached = await this.prisma.farmPrediction.findUnique({
      where: { farmId }
    });
    if (this.parsePayload(cached?.predictionsJson)) {
      return;
    }

    this.regenerating.add(farmId);
    try {
      await this.generateInternal(farmId);
    } finally {
      this.regenerating.delete(farmId);
    }
  }

  private async buildResult(farmId: string): Promise<FarmPredictionsResult> {
    await this.ensureGeneratedIfNeeded(farmId);

    const [cached, collected] = await Promise.all([
      this.prisma.farmPrediction.findUnique({ where: { farmId } }),
      this.collector.collect(farmId)
    ]);

    const sufficient = collected.days_of_data >= PREDICTION_MIN_DAYS;
    const daysRemaining = Math.max(
      0,
      PREDICTION_MIN_DAYS - collected.days_of_data
    );

    const payload = this.parsePayload(cached?.predictionsJson);
    const hasPredictions =
      sufficient && payload != null && Object.keys(payload).length > 0;

    const unavailable = sufficient && !this.agent.isConfigured();
    let geminiError: string | null = null;
    if (unavailable) {
      geminiError =
        "IA indisponible — vérifiez GEMINI_API_KEY côté API.";
    } else if (sufficient && !hasPredictions) {
      geminiError =
        "Les prévisions n'ont pas pu être calculées. Réessayez plus tard.";
    }

    return {
      farm_id: farmId,
      generated_at: cached?.generatedAt?.toISOString() ?? null,
      data_quality_score: cached?.dataQualityScore
        ? Number(cached.dataQualityScore)
        : collected.data_quality_score,
      days_of_data: collected.days_of_data,
      horizon_days: cached?.horizonDays ?? PREDICTION_HORIZON_DAYS,
      sufficient_data: sufficient,
      insufficient_data: sufficient
        ? undefined
        : {
            message:
              "Prévisions disponibles après 30 jours d'utilisation",
            current_days: collected.days_of_data,
            days_remaining: daysRemaining,
            missing: collected.missing
          },
      predictions: hasPredictions ? payload : null,
      unavailable,
      gemini_error: geminiError,
      currency: collected.currency
    };
  }

  private mergeStockPredictions(
    gemini: FarmPredictionsPayload | null,
    stock: FarmPredictionsPayload["stock_predictions"] | null
  ): FarmPredictionsPayload | null {
    if (!stock) {
      return gemini;
    }
    if (!gemini) {
      return null;
    }
    return {
      ...gemini,
      stock_predictions: stock
    };
  }

  private parsePayload(json: unknown): FarmPredictionsPayload | null {
    if (!json || typeof json !== "object") {
      return null;
    }
    const o = json as Record<string, unknown>;
    if (!o.cheptel_predictions) {
      return null;
    }
    return json as FarmPredictionsPayload;
  }

  private sliceForMenu(
    full: FarmPredictionsResult,
    menu: PredictionMenuKey
  ): FarmPredictionsResult {
    if (!full.predictions) {
      return full;
    }

    const p = full.predictions;
    let sliced: FarmPredictionsPayload | null = null;

    switch (menu) {
      case "cheptel":
        sliced = {
          ...p,
          finance_predictions: {
            revenue_estimates: p.finance_predictions.revenue_estimates,
            expense_projections: {
              "30j": { feed_cost: 0, vet_cost: 0, total: 0 },
              "60j": { feed_cost: 0, vet_cost: 0, total: 0 },
              "90j": { feed_cost: 0, vet_cost: 0, total: 0 }
            },
            profitability_forecast: p.finance_predictions.profitability_forecast,
            cash_flow_alert: {
              has_alert: false,
              alert_date: null,
              message: null
            }
          },
          stock_predictions: {
            feed_needs: [],
            total_feed_cost_30j: 0,
            total_feed_cost_60j: 0,
            total_feed_cost_90j: 0
          },
          gestation_predictions: {
            upcoming_births: [],
            available_sows_for_mating: [],
            projected_new_animals_30j: 0,
            projected_new_animals_60j: 0,
            projected_new_animals_90j: 0
          },
          alerts: p.alerts.filter(
            (a) =>
              a.target_menu === "cheptel" || a.target_menu === "dashboard"
          )
        };
        break;
      case "finance":
        sliced = {
          ...p,
          cheptel_predictions: {
            animals_ready_to_sell: p.cheptel_predictions.animals_ready_to_sell,
            best_sale_window: p.cheptel_predictions.best_sale_window,
            weight_projections: [],
            herd_evolution: p.cheptel_predictions.herd_evolution
          },
          stock_predictions: {
            feed_needs: p.stock_predictions.feed_needs,
            total_feed_cost_30j: p.stock_predictions.total_feed_cost_30j,
            total_feed_cost_60j: p.stock_predictions.total_feed_cost_60j,
            total_feed_cost_90j: p.stock_predictions.total_feed_cost_90j
          },
          gestation_predictions: {
            upcoming_births: [],
            available_sows_for_mating: [],
            projected_new_animals_30j: 0,
            projected_new_animals_60j: 0,
            projected_new_animals_90j: 0
          },
          sale_timing: p.sale_timing,
          alerts: p.alerts.filter(
            (a) =>
              a.target_menu === "finance" || a.target_menu === "dashboard"
          )
        };
        break;
      case "stock":
        sliced = {
          ...p,
          cheptel_predictions: {
            animals_ready_to_sell: {
              "30j": { count: 0, estimated_weight_kg: 0, category: "" },
              "60j": { count: 0, estimated_weight_kg: 0, category: "" },
              "90j": { count: 0, estimated_weight_kg: 0, category: "" }
            },
            best_sale_window: p.cheptel_predictions.best_sale_window,
            weight_projections: [],
            herd_evolution: p.cheptel_predictions.herd_evolution
          },
          finance_predictions: {
            revenue_estimates: p.finance_predictions.revenue_estimates,
            expense_projections: p.finance_predictions.expense_projections,
            profitability_forecast: {
              "30j": { margin: 0, margin_pct: 0 },
              "60j": { margin: 0, margin_pct: 0 },
              "90j": { margin: 0, margin_pct: 0 }
            },
            cash_flow_alert: p.finance_predictions.cash_flow_alert
          },
          gestation_predictions: {
            upcoming_births: [],
            available_sows_for_mating: [],
            projected_new_animals_30j: 0,
            projected_new_animals_60j: 0,
            projected_new_animals_90j: 0
          },
          sale_timing: p.sale_timing,
          alerts: p.alerts.filter(
            (a) => a.target_menu === "stock" || a.target_menu === "dashboard"
          )
        };
        break;
      case "gestation":
        sliced = {
          ...p,
          cheptel_predictions: {
            animals_ready_to_sell: {
              "30j": { count: 0, estimated_weight_kg: 0, category: "" },
              "60j": { count: 0, estimated_weight_kg: 0, category: "" },
              "90j": { count: 0, estimated_weight_kg: 0, category: "" }
            },
            best_sale_window: p.cheptel_predictions.best_sale_window,
            weight_projections: [],
            herd_evolution: p.cheptel_predictions.herd_evolution
          },
          finance_predictions: {
            revenue_estimates: {
              "30j": { amount: 0, confidence: 0, based_on: "" },
              "60j": { amount: 0, confidence: 0, based_on: "" },
              "90j": { amount: 0, confidence: 0, based_on: "" }
            },
            expense_projections: {
              "30j": { feed_cost: 0, vet_cost: 0, total: 0 },
              "60j": { feed_cost: 0, vet_cost: 0, total: 0 },
              "90j": { feed_cost: 0, vet_cost: 0, total: 0 }
            },
            profitability_forecast: {
              "30j": { margin: 0, margin_pct: 0 },
              "60j": { margin: 0, margin_pct: 0 },
              "90j": { margin: 0, margin_pct: 0 }
            },
            cash_flow_alert: {
              has_alert: false,
              alert_date: null,
              message: null
            }
          },
          stock_predictions: {
            feed_needs: [],
            total_feed_cost_30j: 0,
            total_feed_cost_60j: 0,
            total_feed_cost_90j: 0
          },
          sale_timing: p.sale_timing,
          alerts: p.alerts.filter(
            (a) =>
              a.target_menu === "gestation" || a.target_menu === "dashboard"
          )
        };
        break;
      case "summary":
        sliced = p;
        break;
      default:
        sliced = p;
    }

    return { ...full, predictions: sliced };
  }
}
