export const PREDICTION_MIN_DAYS = 30;
export const PREDICTION_HORIZON_DAYS = 90;

export type PredictionHorizonKey = "30j" | "60j" | "90j";

export type AnimalsReadyHorizon = {
  count: number;
  estimated_weight_kg: number;
  category: string;
};

export type WeightProjection = {
  pen_id: string;
  pen_name: string;
  current_avg_weight: number;
  projected_30j: number;
  projected_60j: number;
  projected_90j: number;
  target_weight: number;
  days_to_target: number;
};

export type FarmPredictionsPayload = {
  cheptel_predictions: {
    animals_ready_to_sell: Record<PredictionHorizonKey, AnimalsReadyHorizon>;
    best_sale_window: {
      start_date: string;
      end_date: string;
      reason: string;
      confidence: number;
    };
    weight_projections: WeightProjection[];
    herd_evolution: {
      current_count: number;
      projected_30j: number;
      projected_60j: number;
      projected_90j: number;
      growth_rate: number;
    };
  };
  finance_predictions: {
    revenue_estimates: Record<
      PredictionHorizonKey,
      { amount: number; confidence: number; based_on: string }
    >;
    expense_projections: Record<
      PredictionHorizonKey,
      { feed_cost: number; vet_cost: number; total: number }
    >;
    profitability_forecast: Record<
      PredictionHorizonKey,
      { margin: number; margin_pct: number }
    >;
    cash_flow_alert: {
      has_alert: boolean;
      alert_date: string | null;
      message: string | null;
    };
  };
  stock_predictions: {
    feed_needs: Array<{
      feed_type_id: string;
      feed_type_name: string;
      current_stock_kg: number;
      daily_consumption_kg: number;
      needed_30j_kg: number;
      needed_60j_kg: number;
      needed_90j_kg: number;
      stock_depletion_date: string;
      reorder_recommended_date: string;
      reorder_quantity_kg: number;
    }>;
    total_feed_cost_30j: number;
    total_feed_cost_60j: number;
    total_feed_cost_90j: number;
  };
  gestation_predictions: {
    upcoming_births: Array<{
      sow_id: string;
      sow_number: string;
      expected_birth_date: string;
      expected_piglets_count: number;
      confidence: number;
    }>;
    available_sows_for_mating: Array<{
      sow_id: string;
      sow_number: string;
      available_from: string;
      reason: string;
    }>;
    projected_new_animals_30j: number;
    projected_new_animals_60j: number;
    projected_new_animals_90j: number;
  };
  sale_timing: {
    optimal_window: {
      start_date: string;
      end_date: string;
      expected_price_per_kg: number;
      reason: string;
    };
    price_trend: "hausse" | "stable" | "baisse";
    price_trend_explanation: string;
    avoid_windows: Array<{
      start_date: string;
      end_date: string;
      reason: string;
    }>;
  };
  alerts: Array<{
    type:
      | "stock_critical"
      | "cash_flow"
      | "mortality_risk"
      | "overstock"
      | "opportunity";
    priority: "high" | "medium" | "low";
    message: string;
    action_recommended: string;
    target_menu: "cheptel" | "finance" | "stock" | "gestation" | "dashboard";
  }>;
};

export type InsufficientDataInfo = {
  message: string;
  current_days: number;
  days_remaining: number;
  missing?: {
    gmq?: boolean;
    price?: boolean;
    feed?: boolean;
  };
};

export type FarmPredictionsResult = {
  farm_id: string;
  generated_at: string | null;
  data_quality_score: number | null;
  days_of_data: number;
  horizon_days: number;
  sufficient_data: boolean;
  insufficient_data?: InsufficientDataInfo;
  predictions: FarmPredictionsPayload | null;
  /** Aligné sur `AiService` — true si GEMINI_API_KEY absente côté API. */
  unavailable?: boolean;
  gemini_error?: string | null;
  currency?: string;
};

export type PredictionMenuKey =
  | "cheptel"
  | "finance"
  | "stock"
  | "gestation"
  | "summary";

export type CollectedPredictionData = {
  cheptel_data: unknown;
  gmq_data: unknown;
  gestation_data: unknown;
  mortality_data: unknown;
  price_data: unknown;
  feed_data: unknown;
  finance_data: unknown;
  settings_data: unknown;
  days_of_data: number;
  data_quality_score: number;
  currency: string;
  missing: {
    gmq: boolean;
    price: boolean;
    feed: boolean;
  };
};
