import {
  fetchFarmPredictionsMenu,
  generateFarmPredictions
} from "../../lib/api/predictions";
import type {
  FarmPredictionsResult,
  PredictionMenuKey
} from "./predictionTypes";

export type LoadPredictionsParams = {
  farmId: string;
  menu: PredictionMenuKey;
  accessToken: string;
  activeProfileId?: string | null;
  forceRefresh?: boolean;
};

/**
 * Même logique que AIRecommendationService :
 * - lecture cache serveur (GET)
 * - génération à la demande (POST) si données suffisantes mais cache vide
 * - la clé GEMINI_API_KEY est lue côté API via AiGeminiService
 */
export async function loadPredictions(
  params: LoadPredictionsParams
): Promise<FarmPredictionsResult> {
  const { farmId, menu, accessToken, activeProfileId, forceRefresh } = params;

  if (forceRefresh) {
    return generateFarmPredictions(accessToken, farmId, activeProfileId);
  }

  const cached = await fetchFarmPredictionsMenu(
    accessToken,
    farmId,
    menu,
    activeProfileId
  );

  if (cached.insufficient_data || cached.unavailable) {
    return cached;
  }

  if (cached.predictions) {
    return cached;
  }

  // Cache vide : déclencher la génération (comme POST /ai/recommendations)
  try {
    return await generateFarmPredictions(accessToken, farmId, activeProfileId);
  } catch {
    return cached;
  }
}

export async function refreshPredictionsInBackground(
  params: Omit<LoadPredictionsParams, "forceRefresh"> & {
    onUpdate?: (result: FarmPredictionsResult) => void;
  }
): Promise<void> {
  try {
    const fresh = await loadPredictions({ ...params, forceRefresh: true });
    params.onUpdate?.(fresh);
  } catch {
    /* silencieux — pas de crash */
  }
}
