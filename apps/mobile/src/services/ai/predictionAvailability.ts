import type { FarmPredictionsResult } from "./predictionTypes";

/** Prévisions exploitables (données suffisantes + payload Gemini). */
export function isPredictionsPayloadActive(
  data: FarmPredictionsResult | null | undefined
): boolean {
  return Boolean(
    data?.sufficient_data && data.predictions && !data.unavailable && !data.gemini_error
  );
}
