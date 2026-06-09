import {
  fetchFarmPredictions,
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

/** Client léger — récupère les prévisions en cache ou force la régénération. */
export async function loadPredictions(
  params: LoadPredictionsParams
): Promise<FarmPredictionsResult> {
  const { farmId, menu, accessToken, activeProfileId, forceRefresh } = params;

  if (forceRefresh) {
    return generateFarmPredictions(
      accessToken,
      farmId,
      activeProfileId
    );
  }

  return fetchFarmPredictionsMenu(
    accessToken,
    farmId,
    menu,
    activeProfileId
  );
}

export async function refreshPredictionsInBackground(
  params: Omit<LoadPredictionsParams, "forceRefresh"> & {
    onUpdate?: (result: FarmPredictionsResult) => void;
  }
): Promise<void> {
  try {
    const fresh = await fetchFarmPredictions(
      params.accessToken,
      params.farmId,
      params.activeProfileId
    );
    params.onUpdate?.(fresh);
  } catch {
    /* silencieux — pas de crash */
  }
}
